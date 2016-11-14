var express = requireMain("express");
var bcrypt = requireMain("bcrypt");
var db = requireMain("./utils/database");
var sessions = requireMain("./utils/sessions");
var middleware = requireMain("./middleware");
var resetpass = requireMain("./utils/password-recovery");
var mail = requireMain("./utils/mail");
var socket = requireMain("./socket");

var router = express.Router();

/**
 * AJAX POST /ajax/login
 */
router.post("/ajax/login", middleware.ajaxShouldBeLoggedOut, function(req, res) {
	req.sanitizeBody("username").trim();
	req.checkBody("username", "Username can't be empty").notEmpty();
	req.checkBody("password", "Password can't be empty").notEmpty();

	if(req.validationErrors()) {
		res.status(400).json({
			error: req.validationErrors()[0].msg
		});
		return;
	}

	db.query("SELECT * FROM users WHERE username=?", [req.body.username], function(err, results) {
		if(!results.length) {
			res.status(400).json({
				error: "Invalid username"
			});
			return;
		}

		var row = results[0];

		if(!row["allow_login"]) {
			res.status(400).json({
				error: "Your account is disabled"
			});
			return;
		}

		bcrypt.compare(req.body.password, row.password, function(err, ok) {
			if(!ok) {
				res.status(400).json({
					error: "Invalid password"
				});
				return;
			}

			sessions.createSession(row.id, row.username, req.ip, req.get("user-agent"), function(err, sessid) {
				res.cookie("session", sessid);
				res.json({
					status: "ok"
				});
			});
		});
	});
});

/**
 * AJAX POST /ajax/signup
 */
router.post("/ajax/signup", middleware.ajaxShouldBeLoggedOut, function(req, res) {
	req.sanitizeBody("username").trim();
	req.sanitizeBody("email").trim();
	req.sanitizeBody("email2").trim();
	req.sanitizeBody("defaultBTC").trim();

	req.checkBody("username").notEmpty().withMessage("Username can't be empty").matches(/[a-zA-Z0-9\-_]+/).withMessage("Username can contain only upper and lower case english letters (a-z), digits (0-9), dash (-) and underscore (_)");
	req.checkBody("password").notEmpty().withMessage("Password can't be empty").isLength({min:8}).withMessage("Password should be at least 8 characters long");
	req.checkBody("password2").notEmpty().withMessage("Password can't be empty").equals(req.body.password).withMessage("Passwords don't match");
	req.checkBody("email").notEmpty().withMessage("Email can't be empty").isEmail().withMessage("This is not a valid email address");
	req.checkBody("email2").notEmpty().withMessage("Email can't be empty").equals(req.body.email).withMessage("Emails don't match");

	if(req.validationErrors()) {
		res.status(400).json({
			error: req.validationErrors()[0].msg
		});
		return;
	}

	db.query("SELECT * FROM users WHERE username=? OR email=?", [req.body.username, req.body.email], function(err, results) {
		if(results.length > 0) {
			if(results[0].username == req.body.username) {
				res.status(400).json({
					error: "Username already taken"
				});
			}
			else {
				res.status(400).json({
					error: "Email already used"
				});
			}

			return;
		}

		bcrypt.hash(req.body.password, 10, function(err, hash) {
			var userid = 0;
			db.query(
				"INSERT INTO users (id,username,password,email,defaultBTC) VALUES (?,?,?,?,?)",
				[userid = Math.floor(Math.random()*1000000000), req.body.username, hash, req.body.email, req.body.defaultBTC ? req.body.defaultBTC : null],
				function insertcb(err, result) {
					if(err) {
						db.query(
							"INSERT INTO users (id,username,password,email,defaultBTC) VALUES (?,?,?,?,?)",
							[userid = Math.floor(Math.random()*1000000000), req.body.username, hash, req.body.email, req.body.defaultBTC ? req.body.defaultBTC : null],
							insertcb);
						return;
					}

					sessions.createSession(userid, req.body.username, req.ip, req.get("user-agent"), function(err, sessid) {
						res.cookie("session", sessid);
						res.json({
							status: "ok"
						});
					});
				});
		});
	});

});

/**
 * GET /logout
 */
router.get("/logout", middleware.shouldBeLoggedIn, function(req, res) {
	sessions.removeSession(req.session.id, function(err, id) {
		socket.logoutUser(req.session.userid, req.session.id);
		res.clearCookie("session");
		res.redirect("/");
	});
});

/**
 * AJAX POST /ajax/resetpass
 */
router.post("/ajax/resetpass", middleware.ajaxShouldBeLoggedOut, function(req, res) {
	req.sanitizeBody("email").trim();

	req.checkBody("email").notEmpty().withMessage("Email can't be empty").isEmail().withMessage("This is not a valid email address");

	if(req.validationErrors()) {
		res.status(400).json({
			error: req.validationErrors()[0].msg
		});
		return;
	}

	db.query("SELECT * FROM users WHERE email=?", [req.body.email], function(err, result) {
		if(result.length < 1) {
			res.status(400).json({
				error: "User not found"
			});
			return;
		}

		var row = result[0];

		resetpass.generateToken(row["id"], function(err, token) {

			res.json({
				message: "The password reset link is sent to your email"
			});


			/**
			 * 
			 * 				TODO domain in reset url
			 *
			 * 			http://example.com/reset/:token
			 * 
			 */
			
			var reset_link = req.protocol + "://" + req.get("Host") + "/reset/" + token;

			var nl = "\r\n";
			var mailbody = "Hello " + row["username"] + "," + nl + nl +
				"Somebody requested a password reset for your account. If it wasn't you, please ignore this email." + nl + nl +
				"To set a new password, please follow this link:" + nl +
				reset_link + nl + nl +
				"This link is valid for only 12 hours." + nl + nl +
				"Thanks," + nl +
				"The Bitcoin Gambling Team"

			mail.sendSingle(req.body.email, "Reset password", mailbody);

		});

	});
});

/**
 * GET /reset/:token
 */
router.get("/reset/:token", middleware.shouldBeLoggedOut, function(req, res) {
	var token = req.params.token;

	resetpass.verifyToken(token, function(err, result) {
		if(result) {
			res.render("resetpass/reset-password.html");
		}
		else {
			res.render("resetpass/invalid-reset-token.html");
		}
	});
});

/**
 * POST /reset/:token
 */
router.post("/reset/:token", middleware.shouldBeLoggedOut, function(req, res) {
	var token = req.params.token;

	resetpass.verifyToken(token, function(err, result) {
		if(!result) {
			res.render("resetpass/invalid-reset-token.html");
			return;
		}

		var userid = parseInt(token.split("-")[0]);

		req.checkBody("password").notEmpty().withMessage("Password can't be empty");
		req.checkBody("password2").notEmpty().withMessage("Password can't be empty").equals(req.body.password).withMessage("Passwords don't match");

		if(req.validationErrors()) {
			res.render("resetpass/reset-password.html", {
				form_error: req.validationErrors()[0].msg,
				form_password: req.body.password,
				form_password2: req.body.password2
			});
			return;
		}

		bcrypt.hash(req.body.password, 10, function(err, hash) {
			db.query("UPDATE users SET password=? WHERE id=?", [hash, userid], function(err, result) {
				res.render("resetpass/reset-successfull.html");
			});
		});
	});
});

module.exports = router;
