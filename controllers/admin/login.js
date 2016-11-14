var express = requireMain("express");
var db = requireMain("./utils/database");
var middleware = requireMain("./middleware");
var bcrypt = requireMain("bcrypt");
var sessions = requireMain("./utils/sessions");
var async = requireMain("async");


var router = express.Router();


router.get("/admin/login", middleware.adminShouldBeLoggedOut, function(req, res) {
	res.render("admin/login.html");
});

router.post("/admin/login", middleware.adminShouldBeLoggedOut, function(req, res, next) {
	req.sanitizeBody("username").trim();
	req.checkBody("username", "Username can't be empty").notEmpty();
	req.checkBody("password", "Password can't be empty").notEmpty();

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				callback(req.validationErrors()[0].msg);
			else
				callback(null);
		},

		function(callback) {
			db.query("SELECT * FROM admins WHERE username=?", [req.body.username], function(err, result) {
				if(err)
					callback(true, null);
				else if(!result.length)
					callback("Invalid username or password", null);
				else
					callback(null, result[0]);
			});
		},

		function(row, callback) {
			bcrypt.compare(req.body.password, row.password, function(err, ok) {
				if(err)
					callback(true, null);
				else if(!ok)
					callback("Invalid username or password", row);
				else
					callback(null, row);
			});
		},

		function(row, callback) {
			sessions.createAdminSession(row.id, row.username, req.ip, req.get("user-agent"), function(err, sessid) {
				callback(!!err, sessid);
			});
		}

	], function(err, sessid) {
		if(err === true)
			res.flash("danger", "An error occurred, please try again");
		else if(err)
			res.flash("danger", err);

		if(err)
			res.redirect("/admin/login");
		else {
			res.cookie("admin", sessid);
			res.redirect("/admin");
		}
	});

});

router.get("/admin/logout", middleware.adminShouldBeLoggedIn, function(req, res) {
	sessions.removeAdminSession(req.admin.id, function(err, id) {
		//socket.logoutUser(req.admin.userid, req.admin.id);
		res.clearCookie("admin");
		res.redirect("/admin/login");
	});
});


module.exports = router;