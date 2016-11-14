var express = requireMain("express");
var middleware = requireMain("./middleware");
var db = requireMain("./utils/database");
var async = requireMain("async");
var bcrypt = requireMain("bcrypt");

var router = express.Router();

router.get("/admin", middleware.adminShouldBeLoggedIn, function(req, res) {
	res.render("admin/home.html");
});

router.get("/admin/settings", middleware.adminShouldBeLoggedIn, function(req, res, next) {
	res.render("admin/settings.html");
});

router.post("/admin/settings/password", middleware.adminShouldBeLoggedIn, function(req, res, next) {
	req.checkBody("oldpassword").notEmpty().withMessage("Invalid old password");
	req.checkBody("password").notEmpty().withMessage("New password can't be empty");
	req.checkBody("password2").equals(req.body.password).withMessage("Passwords don't match");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				return callback(req.validationErrors()[0].msg);
			callback(null);
		},

		function(callback) {
			db.query("SELECT * FROM admins WHERE id=?", [req.admin.userid], function(err, result) {
				if(err)
					return callback(true, null);
				if(result.length != 1)
					return callback(true, null);
				callback(null, result[0].password);
			});
		},

		function(oldhash, callback) {
			bcrypt.compare(req.body.oldpassword, oldhash, function(err, result) {
				if(err)
					return callback(true);
				if(!result)
					return callback("Invalid old password");
				callback(null);
			});
		},

		function(callback) {
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				callback(!!err, hash);
			});
		},

		function(hash, callback) {
			db.query("UPDATE admins SET password=? WHERE id=?", [hash, req.admin.userid], function(err, result) {
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

		res.redirect("/admin/settings");
	});
});


module.exports = router;