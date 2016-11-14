var express = requireMain("express");
var db = requireMain("./utils/database");
var middleware = requireMain("./middleware");
var async = requireMain("async");
var userAgentParser = requireMain("user-agent-parser");
var geoip = requireMain("./utils/geoip");
var socket = requireMain("./socket");
var async = requireMain("async");
var bcrypt = requireMain("bcrypt");
var btc = requireMain("./utils/btc");
var pagination = requireMain("./utils/pagination");


var router = express.Router();


router.get("/admin/users", middleware.adminShouldBeLoggedIn, function(req, res) {
	res.render("admin/users/list.html");
});

router.get("/admin/users/search", middleware.adminShouldBeLoggedIn, function(req, res, next) {
	var search = req.query.q;
	var like = '%' + search + '%';

	db.query("SELECT users.id,users.username,users.email,DATE_FORMAT(users.signupdate, '%Y-%m-%d %H:%i:%s') AS signupdate,DATE_FORMAT(MAX(sessions.lastlogin), '%Y-%m-%d %H:%i:%s') AS lastactive FROM users LEFT JOIN sessions ON users.id=sessions.userid WHERE users.id=? OR users.username LIKE ? OR users.email LIKE ? GROUP BY users.id", [search, like, like], function(err, result) {
		if(err)
			return next(err);

		res.json({
			users: result
		});
	});
});

router.get("/admin/users/:id", middleware.adminShouldBeLoggedIn, function(req, res, next) {
	db.query("SELECT *,DATE_FORMAT(users.signupdate, '%Y-%m-%d %H:%i:%s') AS signupdate,CAST(ROUND(balance/100000000,8) AS CHAR) AS balance FROM users WHERE id=?", [req.params.id], function(err, result) {
		if(err)
			return next(err);
		
		res.render("admin/users/user.html", result[0]);
	});
});

router.get("/admin/users/:id/sessions", middleware.adminShouldBeLoggedIn, function(req, res, next) {
	db.query("SELECT * FROM users WHERE id=?", [req.params.id], function(err, user) {
		if(err)
			return next(err);
		
		db.query("SELECT *,DATE_FORMAT(lastlogin, '%Y-%m-%d %H:%i:%s') AS lastlogin FROM sessions WHERE userid=? AND active=1", [req.params.id], function(err, result) {
			if(err)
				return next(err);
			
			result.forEach(function(row) {
				var ua = userAgentParser(row.useragent);
				row.os = ua.os.name
				row.browser = ua.browser.name;
				var geo = geoip(row.ip);
				if(geo)
					row.location = geo.continent.names.en + ", " + geo.country.names.en;
				row.online = socket.isActive(row.userid, row.id);
			});

			res.render("admin/users/sessions.html", {
				id: user[0].id,
				username: user[0].username,
				sessions: result
			});
		});
	});
});

router.get("/admin/users/:id/sessions/kill/:session", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_sessions"), function(req, res, next) {
	db.query("UPDATE sessions SET active=0 WHERE id=?", [req.params.session], function(err, result) {
		if(err)
			return next(err);
		
		socket.logoutUser(req.params.id, req.params.session);
		res.redirect("/admin/users/"+req.params.id+"/sessions");
	});
});

router.get("/admin/users/:id/transactions", middleware.adminShouldBeLoggedIn, function(req, res, next) {

	var page = parseInt(req.query.page) || 1;
	var perpage = 20;

	async.waterfall([

		function(callback) {
			db.query("SELECT COUNT(*) as num FROM transactions WHERE userid=?", [req.params.id], function(err, result) {
				if(err)
					callback(null, 0);
				else
					callback(null, result[0].num);
			});
		},

		function(count, callback) {
			callback(null, pagination(page, Math.ceil(count/perpage)));
		},

		function(pag, callback) {
			db.query("SELECT *,CAST(ROUND(amount/100000000,8) AS CHAR) AS amount,DATE_FORMAT(time, '%Y-%m-%d %H:%i:%s') AS time FROM transactions WHERE userid=? ORDER BY time DESC LIMIT ?,?", [req.params.id, (page-1)*perpage, perpage], function(err, result) {
				callback(err, pag, result);
			});
		},

		function(pag, tx, callback) {
			db.query("SELECT id,username FROM users WHERE id=?", [req.params.id], function(err, result) {
				if(err)
					callback(err, null, null, null);
				else if(result.length !== 1)
					callback(true, null, null, null);
				else
					callback(null, result[0], pag, tx);
			});
		}

	], function(err, user, pag, tx) {
		if(err)
			next(err);

		res.render("admin/users/transactions.html", {
			transactions: tx,
			pagination: pag,
			id: user.id,
			username: user.username
		});
	});
});

router.post("/admin/users/:id/transactions/confirm/:tx", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_transactions"), function(req, res) {

	var redirect = req.get("referrer") || "/admin/users/"+req.params.id+"/transactions";

	async.waterfall([

		function(callback) {
			db.query("SELECT *,ABS(amount) AS amount FROM transactions WHERE id=?", [req.params.tx], function(err, result) {
				if(err)
					callback(!!err, null);
				else if(result.length !== 1)
					callback("Unknown transaction", null);
				else if(result[0].status !== "Requested")
					callback("This transaction is already completed", null);
				else
					callback(null, result[0]);
			});
		},

		function(row, callback) {
			btc.withdraw(row.toaddr, row.amount, function(err, result) {
				callback(!!err, result);
			});
		},

		function(tx, callback) {
			db.query("UPDATE transactions SET transaction=?, status=? WHERE id=?", [tx.tx.hash, "Completed", req.params.tx], function(err, result) {
				callback(!!err);
			});
		},

		function(callback) {
			db.query("SELECT id, userid, type, status, CAST(ROUND(amount/100000000,8) AS CHAR) AS amount, DATE_FORMAT(time, '%e %b, %l:%i%p') AS `date`, transaction FROM transactions WHERE id=?", [req.params.tx], function(err, result) {
				callback(!!err, result);
			});
		}

	], function(err, result) {
		if(err === true) {
			res.flash("danger", "An error occurred, please try again");
		}
		else if(err) {
			res.flash("danger", err);
		}
		else {
			res.flash("success", "Transaction confirmed");
			socket.emitUser(result[0].userid, "tx-status-changed", result[0]);
		}

		res.redirect(redirect);
	});

});

router.post("/admin/users/:id/option/:switch", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_options"), function(req, res) {
	req.sanitizeBody("value").toBoolean();

	db.query("UPDATE users SET ??=? WHERE id=?", [req.params.switch, req.body.value ? 1 : 0, req.params.id], function(err, result) {
		res.end();
	});
});

router.post("/admin/users/:id/email", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_settings"), function(req, res) {
	req.sanitizeBody("email").trim();

	req.checkBody("email").notEmpty().withMessage("Email address can't be empty").isEmail().withMessage("It's not a valid email address");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				callback(req.validationErrors()[0].msg);
			else
				callback(null);
		},

		function(callback) {
			db.query("UPDATE users SET email=? WHERE id=?", [req.body.email, req.params.id], function(err, result) {
				callback(!!err);
			});
		}

	], function(err) {
		if(err === true)
			res.flash("danger", "An error occurred, please try again");
		else if(err)
			res.flash("danger", err);
		else
			res.flash("success", "Email changed");
		res.redirect("/admin/users/"+req.params.id);
	});
});

router.post("/admin/users/:id/password", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_settings"), function(req, res) {
	req.checkBody("password").notEmpty().withMessage("Password can't be empty");
	req.checkBody("password2").notEmpty().withMessage("Password can't be empty").equals(req.body.password).withMessage("Passwords don't match");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				callback(req.validationErrors()[0].msg);
			else
				callback(null);
		},

		function(callback) {
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				callback(!!err, hash);
			});
		},

		function(hash, callback) {
			db.query("UPDATE users SET password=? WHERE id=?", [hash, req.params.id], function(err, result) {
				callback(!!err);
			});
		}

	], function(err) {
		if(err === true)
			res.flash("danger", "An error occurred, please try again");
		else if(err)
			res.flash("danger", err);
		else
			res.flash("success", "Password changed");
		res.redirect("/admin/users/"+req.params.id);
	});
});

router.post("/admin/users/:id/newdeposit", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_settings"), function(req, res) {
	async.waterfall([

		function(callback) {
			btc.createDepositAddress(function(err, addr) {
				callback(!!err, addr);
			});
		},

		function(addr, callback) {
			db.query("UPDATE users SET currentBTC=?, current_forwarder=?, current_event=? WHERE id=?", [addr.address, addr.forwardid, addr.hookid, req.params.id], function(err, result) {
				callback(!!err);
			});
		}

	], function(err) {
		if(err)
			res.flash("danger", "An error occurred, please try again");
		else
			res.flash("success", "Deposit address created");
		res.redirect("/admin/users/"+req.params.id);
	});
});

router.post("/admin/users/:id/defaultbtc", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_settings"), function(req, res) {
	req.sanitizeBody("btc").trim();

	db.query("UPDATE users SET defaultBTC=? WHERE id=?", [req.body.btc, req.params.id], function(err, result) {
		if(err)
			res.flash("danger", "An error occurred, please try again");
		else
			res.flash("success", "Emergency address changed");
		res.redirect("/admin/users/"+req.params.id);
	});
});


module.exports = router;