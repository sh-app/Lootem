var express = requireMain("express");
var middleware = requireMain("./middleware");
var db = requireMain("./utils/database");
var bcrypt = requireMain("bcrypt");
var async = requireMain("async");
var btc = requireMain("./utils/btc");
var socket = requireMain("./socket");

var router = express.Router();

/**
 * GET /profile
 */
router.get("/profile", middleware.shouldBeLoggedIn, function(req, res, next) {
	db.query("SELECT * FROM users WHERE id=?", [req.session.userid], function(err, result) {
		if(err)
			return next(err);

		var row = result[0];
		res.render("profile/home.html", {
			userid: row["id"],
			username: row["username"],
			email: row["email"],
			defaultbtc: row["defaultBTC"]
		});
	});
});

/**
 * GET /profile/transactions
 */
router.get("/profile/transactions", middleware.shouldBeLoggedIn, function(req, res, next) {
	async.parallel([
		function(callback) {
			db.query("SELECT CAST(ROUND(balance/100000000,8) AS CHAR) AS balance, currentBTC FROM users WHERE id=?", [req.session.userid], function(err, res) {
				callback(err, res);
			});
		},
		function(callback) {
			db.query("SELECT id, type, status, CAST(ROUND(amount/100000000,8) AS CHAR) AS amount, DATE_FORMAT(time, '%e %b, %l:%i%p') AS `date`, transaction FROM transactions WHERE userid=? ORDER BY time DESC", [req.session.userid], function(err, res) {
				callback(err, res);
			});
		}
	], function(err, results) {
		if(err)
			return next(err);

		res.render("profile/transactions.html", {
			balance: results[0][0]["balance"],
			depositAddress: results[0][0]["currentBTC"],
			transactions: results[1]
		});
	});
});

/**
 * GET /profile/gamehistory
 */
router.get("/profile/gamehistory", middleware.shouldBeLoggedIn, function(req, res) {
	res.render("layout.html");
});

/**
 * AJAX POST /ajax/changepass
 */
router.post("/ajax/changepass", middleware.ajaxShouldBeLoggedIn, function(req, res) {
	req.checkBody("oldpassword").notEmpty().withMessage("Password can't be empty");
	req.checkBody("password").notEmpty().withMessage("Password can't be empty").isLength({min:8}).withMessage("Password should be at least 8 characters long");
	req.checkBody("password2").notEmpty().withMessage("Password can't be empty").equals(req.body.password).withMessage("Passwords don't match");

	if(req.validationErrors()) {
		res.status(400).json({
			error: req.validationErrors()[0].msg
		});
		return;
	}

	db.query("SELECT password FROM users WHERE id=?", [req.session.userid], function(err, result) {
		var row = result[0];

		bcrypt.compare(req.body.oldpassword, row.password, function(err, ok) {
			if(!ok) {
				res.status(400).json({
					error: "Invalid current password"
				});
				return;
			}

			bcrypt.hash(req.body.password, 10, function(err, hash) {
				db.query("UPDATE users SET password=? WHERE id=?", [hash, req.session.userid], function(err, result) {
					res.json({
						message: "Password changed successfully"
					});
				});
			});
		});
	});
});

/**
 * AJAX POST /ajax/changedefaultbtc
 */
router.post("/ajax/changedefaultbtc", middleware.ajaxShouldBeLoggedIn, function(req, res) {
	req.sanitizeBody("btc").trim();

	req.checkBody("password").notEmpty().withMessage("Password can't be empty");

	if(req.validationErrors()) {
		res.status(400).json({
			error: req.validationErrors()[0].msg
		});
		return;
	}

	db.query("SELECT password FROM users WHERE id=?", [req.session.userid], function(err, result) {
		var row = result[0];

		bcrypt.compare(req.body.password, row.password, function(err, ok) {
			if(!ok) {
				res.status(400).json({
					error: "Invalid current password"
				});
				return;
			}

			db.query("UPDATE users SET defaultBTC=? WHERE id=?", [req.body.btc, req.session.userid], function(err, result) {
				res.json({
					message: "Bitcoin address changed successfully",
					btc: req.body.btc
				});
			});
		});
	});
});

/**
 * AJAX POST /ajax/createdepositaddr
 */
router.post("/ajax/createdepositaddr", middleware.ajaxShouldBeLoggedIn, function(req, res) {
	btc.createDepositAddress(function(err, addr) {
		db.query("UPDATE users SET currentBTC=?, current_forwarder=?, current_event=? WHERE id=?", [addr.address, addr.forwardid, addr.hookid, req.session.userid], function(err, result) {
			res.json({
				address: addr.address
			});
		});
	});
});

/**
 * AJAX POST /ajax/withdraw
 */
router.post("/ajax/withdraw", middleware.ajaxShouldBeLoggedIn, function(req, res) {
	req.sanitizeBody("address").trim();
	req.sanitizeBody("amount").trim();

	req.checkBody("address").notEmpty().withMessage("Bitcoin address can't be empty");
	req.checkBody("amount").notEmpty().withMessage("Amount can't be empty").isDecimal().withMessage("Invalid amount");

	req.body.amount = parseFloat(req.body.amount) * 100000000;

	var sendNotification = function(txid) {
		db.query("SELECT id, type, status, CAST(ROUND(amount/100000000,8) AS CHAR) AS amount, DATE_FORMAT(time, '%e %b, %l:%i%p') AS `date`, transaction FROM transactions WHERE id=?", [txid], function(err, result) {
			if(err)
				return;
			socket.emitUser(req.session.userid, "new-tx", result[0]);
		});

		db.query("SELECT CAST(ROUND(balance/100000000,8) AS CHAR) AS balance FROM users WHERE id=?", [req.session.userid], function(err, result) {
			if(err)
				return;
			socket.emitUser(req.session.userid, "balance-changed", result[0].balance);
		});
	}

	var con = null;
	var always_allow = false;
	var hell = null;
	var insertid = null;

	async.waterfall([

		function(callback) {
			if(req.validationErrors()) {
				callback(req.validationErrors()[0].msg);
			}
			else
				callback(null);
		},

		function(callback) {
			db.getConnection(function(err, connection) {
				if(!err)
					con = connection;
				callback(!!err);
			});
		},

		function(callback) {
			con.beginTransaction(function(err) {
				callback(!!err);
			});
		},

		function(callback) {
			con.query("SELECT * FROM users WHERE id=?", [req.session.userid], function(err, result) {
				if(err)
					return callback(true);

				if(result[0].balance < req.body.amount)
					return callback("You don't have enough bitcoin");

				if(!result[0].allow_withdraws)
					return callback("You can't withdraw bitcoins, please contact the administrator");

				always_allow = result[0].always_allow_withdraws;

				callback(false);
			});
		},

		function(callback) {
			con.query("SELECT amount, pending, wday, wmin, wmax FROM (SELECT IFNULL(SUM(ABS(amount)),0) AS amount FROM transactions WHERE userid=? AND type='Withdraw' AND UNIX_TIMESTAMP(CURRENT_TIMESTAMP)-UNIX_TIMESTAMP(time) < 86400) tday, (SELECT COUNT(*) AS pending FROM transactions WHERE userid=? AND type='Withdraw' AND status='Requested') tpending, (SELECT CAST(IFNULL(svalue,0) AS UNSIGNED) AS wday FROM settings WHERE skey='withdraw_per_day') tlimit,(SELECT CAST(IFNULL(svalue,0) AS UNSIGNED) AS wmin FROM settings WHERE skey='withdraw_min') tmin, (SELECT CAST(IFNULL(svalue,0) AS UNSIGNED) AS wmax FROM settings WHERE skey='withdraw_max') tmax", [req.session.userid, req.session.userid], function(err, result) {
				if(err)
					return callback(true);

				hell = result[0];

				if((hell.wmin) && (req.body.amount < hell.wmin))
					return callback("You can't withdraw less than " + (hell.wmin/100000000));

				if((hell.wmax) && (req.body.amount > hell.wmax))
					return callback("You can't withdraw more than " + (hell.wmax/100000000));

				callback(false);
			});
		},

		function(callback) {
			con.query("UPDATE users SET balance=balance-? WHERE id=?", [req.body.amount, req.session.userid], function(err, result) {
				callback(!!err);
			});
		},

		function(callback) {

			if( !always_allow && ((hell.pending > 0) || (hell.amount+req.body.amount > hell.wday)) ) {

				async.waterfall([

					function(cb) {
						con.query("INSERT INTO transactions (userid,type,status,toaddr,amount) VALUES (?,?,?,?,?)", [req.session.userid,"Withdraw","Requested",req.body.address,-req.body.amount], function(err, result) {
							if(err)
								return cb(true);

							insertid = result.insertId;
							cb(false);
						});
					},

					function(cb) {
						con.commit(function(err) {
							cb(!!err, "Your withdraw request is noted");
						});
					}

				], function(err, result) {
					callback(err, result);
				});

			}
			else {

				async.waterfall([

					function(cb) {
						con.query("INSERT INTO transactions (userid,type,status,toaddr,amount) VALUES (?,?,?,?,?)", [req.session.userid,"Withdraw","Completed",req.body.address,-req.body.amount], function(err, result) {
							if(err)
								return cb(true);

							insertid = result.insertId;
							cb(false);
						});
					},

					function(cb) {
						btc.withdraw(req.body.address, req.body.amount, function(err, result) {
							cb(!!err, result);
						});
					},

					function(tx, cb) {
						con.commit(function(err) {
							cb(!!err, tx);
						});
					},

					function(tx, cb) {
						con.query("UPDATE transactions SET transaction=? WHERE id=?", [tx.tx.hash, insertid], function(err, result) {
							cb(false, "Your withdraw completed successfully");
						});
					}

				], function(err, result) {
					callback(err, result);
				});

			}

		}

	], function(err, result) {
		if(err) {
			if(con)
				con.rollback();

			if(err === true)
				res.status(500).json({
					error: "An error occurred, please try again"
				});
			else
				res.status(400).json({
					error: err
				});
		}
		else {
			res.json({
				message: result
			});

			sendNotification(insertid);
		}

		if(con)
			con.release();
	});

	/*db.getConnection(function(err, con) {

		con.beginTransaction(function(err) {
			if(err) {
				res.status(400).json({
					error: "An error occurred, please try again"
				});
				con.release();
				return;
			}

			con.query("SELECT * FROM users WHERE id=?", [req.session.userid], function(err, result) {
				if(err) {
					res.status(400).json({
						error: "An error occurred, please try again"
					});
					con.rollback();
					con.release();
					return;
				}

				if(result[0].balance < req.body.amount) {
					res.status(400).json({
						error: "You don't have enough bitcoin"
					});
					con.rollback();
					con.release();
					return;
				}

				if(!result[0].allow_withdraws) {
					res.status(400).json({
						error: "You can't withdraw bitcoins, please contact the administrator"
					});
					con.rollback();
					con.release();
					return;
				}

				var always_allow = result[0].always_allow_withdraws;

				con.query("SELECT amount, pending, wday, wmin, wmax FROM (SELECT IFNULL(SUM(ABS(amount)),0) AS amount FROM transactions WHERE userid=? AND type='Withdraw' AND UNIX_TIMESTAMP(CURRENT_TIMESTAMP)-UNIX_TIMESTAMP(time) < 86400) tday, (SELECT COUNT(*) AS pending FROM transactions WHERE userid=? AND type='Withdraw' AND status='Requested') tpending, (SELECT CAST(IFNULL(svalue,0) AS UNSIGNED) AS wday FROM settings WHERE skey='withdraw_per_day') tlimit,(SELECT CAST(IFNULL(svalue,0) AS UNSIGNED) AS wmin FROM settings WHERE skey='withdraw_min') tmin, (SELECT CAST(IFNULL(svalue,0) AS UNSIGNED) AS wmax FROM settings WHERE skey='withdraw_max') tmax", [req.session.userid, req.session.userid], function(err, result) {
					if(err) {
						res.status(400).json({
							error: "An error occurred, please try again"
						});
						con.rollback();
						con.release();
						return;
					}

					var row = result[0];

					if((row.wmin) && (req.body.amount < row.wmin)) {
						res.status(400).json({
							error: "You can't withdraw less than " + (row.wmin/100000000)
						});
						con.rollback();
						con.release();
						return;
					}

					if((row.wmax) && (req.body.amount > row.wmax)) {
						res.status(400).json({
							error: "You can't withdraw mote than " + (row.wmax/100000000)
						});
						con.rollback();
						con.release();
						return;
					}

					con.query("UPDATE users SET balance=balance-? WHERE id=?", [req.body.amount, req.session.userid], function(err, result) {
						if(err) {
							res.status(400).json({
								error: "An error occurred, please try again"
							});
							con.rollback();
							con.release();
							return;
						}


						if(!always_allow && ((row.pending > 0) || (row.amount+req.body.amount > row.wday)) ) {
							con.query("INSERT INTO transactions (userid,type,status,toaddr,amount) VALUES (?,?,?,?,?)", [req.session.userid,"Withdraw","Requested",req.body.address,-req.body.amount], function(err, result) {
								if(err) {
									res.status(400).json({
										error: "An error occurred, please try again"
									});
									con.rollback();
									con.release();
									return;
								}

								var insertId = result.insertId;

								con.commit(function(err) {
									if(err) {
										res.status(400).json({
											error: "An error occurred, please try again"
										});
										con.rollback();
										con.release();
										return;
									}

									con.release();

									res.json({
										message: "Your withdraw request is noted"
									});

									sendNotification(insertId);
								});

							});
						}
						else {
							con.query("INSERT INTO transactions (userid,type,status,toaddr,amount) VALUES (?,?,?,?,?)", [req.session.userid,"Withdraw","Completed",req.body.address,-req.body.amount], function(err, result) {
								if(err) {
									res.status(400).json({
										error: "An error occurred, please try again"
									});
									con.rollback();
									con.release();
									return;
								}

								var insertId = result.insertId;

								btc.withdraw(req.body.address, req.body.amount, function(err, result) {
									if(err) {
										res.status(400).json({
											error: "An error occurred, please try again"
										});
										con.rollback();
										con.release();
										return;
									}

									con.query("UPDATE transactions SET transaction=? WHERE id=?", [result.tx.hash, insertId], function(err, result) {
										con.commit(function(err) {
											if(err) {
												res.status(400).json({
													error: "An error occurred, please try again"
												});
												con.rollback();
												con.release();
												return;
											}

											con.release();

											res.json({
												message: "Your withdraw completed successfully"
											});

											sendNotification(insertId);
										});										
									});
								});
							});
						}
					});
				});
			});
		});

	});*/
});

module.exports = router;