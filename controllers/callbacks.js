var express = requireMain("express");
var db = requireMain("./utils/database");
var async = requireMain("async");
var socket = requireMain("./socket");

var router = express.Router();

/**
 * GET /callbacks/blockcypher/z7824btrz/payment
 */
router.post("/callbacks/blockcypher/z7824btrz/payment", function(req, res) {
	db.query("SELECT id FROM users WHERE currentBTC=?", [req.body.input_address], function(err, result) {
		if(err) {
			res.status(500).end();
			return;
		}

		if(result.length < 1) {
			res.status(200).end();
			return;
		}

		var userid = result[0].id;

		db.query("INSERT INTO transactions (userid,type,status,amount,transaction) VALUES (?,?,?,?,?)", [result[0].id, "Deposit", "Pending", req.body.value, req.body.input_transaction_hash], function(err, result) {
			if(err) {
				res.status(500).end();
				return;
			}

			res.status(200).end();

			db.query("SELECT id, type, status, CAST(ROUND(amount/100000000,8) AS CHAR) AS amount, DATE_FORMAT(time, '%e %b, %l:%i%p') AS `date`, transaction FROM transactions WHERE id=?", [result.insertId], function(err, result) {
				if(err)
					return;
				socket.emitUser(userid, "new-tx", result[0]);
			});
		});
	});
});

/**
 * GET /callbacks/blockcypher/z7824btrz/confirmation
 */
router.post("/callbacks/blockcypher/z7824btrz/confirmation", function(req, res) {
	db.query("SELECT * FROM transactions WHERE transaction=?", [req.body.hash], function(err, result) {
		if(err) {
			res.status(500).end();
			return;
		}
		if(result.length < 1) {
			res.status(200).end();
			return;
		}

		var userid = result[0].userid;
		var txid = result[0].id;

		db.getConnection(function(err, con) {
			if(err) {
				res.status(500).end();
				con.release();
				return;
			}

			con.beginTransaction(function(err) {
				if(err) {
					res.status(500).end();
					con.release();
					return;
				}
				async.parallel([
					function(callback) {
						con.query("UPDATE transactions SET confirmations=1, status=? WHERE transaction=?", ["Confirmed", req.body.hash], function(err, result) { callback(err, result); });
					},
					function(callback) {
						con.query("UPDATE users SET balance=balance+? WHERE id=?", [result[0].amount, result[0].userid], function(err, result) { callback(err, result); });
					}
				], function(err, results) {
					if(err) {
						res.status(500).end();
						con.rollback();
						con.release();
						return;
					}

					con.commit(function(err) {
						if(err) {
							res.status(500).end();
							con.rollback();
							con.release();
							return;
						}

						res.status(200).end();
						con.release();

						db.query("SELECT id, type, status, CAST(ROUND(amount/100000000,8) AS CHAR) AS amount, DATE_FORMAT(time, '%e %b, %l:%i%p') AS `date`, transaction FROM transactions WHERE id=?", [txid], function(err, result) {
							if(err)
								return;
							socket.emitUser(userid, "tx-status-changed", result[0]);
						});

						db.query("SELECT CAST(ROUND(balance/100000000,8) AS CHAR) AS balance FROM users WHERE id=?", [userid], function(err, result) {
							if(err)
								return;
							socket.emitUser(userid, "balance-changed", result[0].balance);
						});
					});
				});
			});
		});

	});
});

module.exports = router;
