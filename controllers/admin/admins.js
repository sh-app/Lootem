var express = requireMain("express");
var db = requireMain("./utils/database");
var middleware = requireMain("./middleware");
var async = requireMain("async");
var bcrypt = requireMain("bcrypt");
var _ = requireMain("lodash");

var router = express.Router();

router.get("/admin/admins", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	db.query("SELECT admins.id,admins.username,admin_roles.name AS role,DATE_FORMAT(MAX(admin_sessions.lastlogin), '%Y-%m-%d %H:%i:%s') AS lastlogin FROM (admins LEFT JOIN admin_roles ON admins.role=admin_roles.id) LEFT JOIN admin_sessions ON admins.id=admin_sessions.userid GROUP BY admins.id", function(err, result) {
		if(err)
			return next(err);

		res.render("admin/admins/list.html", {
			admins: result
		});
	});
});

router.get("/admin/admins/edit/:id", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	async.waterfall([

		function(callback) {
			db.query("SELECT id,name FROM admin_roles", [req.params.id], function(err, result) {
				if(err)
					return callback(true);
				callback(null, result);
			});
		},

		function(roles, callback) {
			db.query("SELECT * FROM admins WHERE id=?", [req.params.id], function(err, result) {
				if(err)
					return callback(err, null);
				if(result.length < 1)
					return callback(true, null);
				var row = result[0];
				row["roles"] = roles;
				callback(null, row);
			});
		}

	], function(err, result) {
		if(err)
			return next(err);

		res.render("admin/admins/editadmin.html", result);
	});
});

router.post("/admin/admins/edit/:id/password", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	req.checkBody("password").notEmpty().withMessage("Password can't be empty");
	req.checkBody("password2").equals(req.body.password).withMessage("Passwords don't match");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				return callback(req.validationErrors()[0].msg);
			callback(null);
		},

		function(callback) {
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				callback(!!err, hash);
			});
		},

		function(hash, callback) {
			db.query("UPDATE admins SET password=? WHERE id=?", [hash, req.params.id], function(err, result) {
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

		res.redirect("/admin/admins/edit/"+req.params.id);
	});
});

router.post("/admin/admins/edit/:id/role", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	db.query("UPDATE admins SET role=? WHERE id=?", [req.body.role, req.params.id], function(err, result) {
		if(err)
			res.flash("danger", "An error occurred, please try again");
		else
			res.flash("success", "Role changed");

		res.redirect("/admin/admins/edit/"+req.params.id);
	});
});

router.post("/admin/admins/edit/:id/delete", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	db.query("DELETE FROM admins WHERE id=?", [req.params.id], function(err, result) {
		if(err) {
			res.flash("danger", "An error occurred, please try again");
			res.redirect("/admin/admins/edit/"+req.params.id);
		}
		else {
			res.flash("success", "Admin deleted");
			res.redirect("/admin/admins");
		}
	});
});

router.get("/admin/admins/new", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	db.query("SELECT id,name FROM admin_roles", function(err, result) {
		if(err)
			return next(err);

		res.render("admin/admins/newadmin.html", {
			roles: result
		});
	});
});

router.post("/admin/admins/new", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	req.sanitizeBody("username").trim();

	req.checkBody("username").notEmpty().withMessage("Username can't be empty");
	req.checkBody("password").notEmpty().withMessage("Password can't be empty");
	req.checkBody("password2").equals(req.body.password).withMessage("Passwords don't match");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				return callback(req.validationErrors()[0].msg);
			callback(null);
		},

		function(callback) {
			db.query("SELECT * FROM admins WHERE username=?", [req.body.username], function(err, result) {
				if(err)
					return callback(true);
				if(result.length > 0)
					return callback("Username already used");
				callback(null);
			});
		},

		function(callback) {
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				callback(!!err, hash);
			});
		},

		function(hash, callback) {
			db.query("INSERT INTO admins (username,password,role) VALUES (?,?,?)", [req.body.username, hash, req.body.role], function(err, result) {
				callback(!!err);
			});
		}

	], function(err) {
		if(err) {
			if(err === true)
				res.flash("danger", "An error occurred, please try again");
			else
				res.flash("danger", err);

			res.redirect("/admin/admins/new");
		}
		else {
			res.flash("success", "Admin created");
			res.redirect("/admin/admins");
		}
	});
});

router.get("/admin/admins/roles", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	db.query("SELECT admin_roles.id,admin_roles.name,COUNT(admins.id) AS `count` FROM admin_roles LEFT JOIN admins ON admin_roles.id=admins.role GROUP BY admin_roles.id", function(err, result) {
		if(err)
			return next(err);

		res.render("admin/admins/roles.html", {
			roles: result
		});
	});
});

router.get("/admin/admins/roles/edit/:id", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	db.query("SELECT * FROM admin_roles WHERE id=?", [req.params.id], function(err, result) {
		if(err)
			return next(err);

		res.render("admin/admins/editrole.html", {
			id: result[0].id,
			name: result[0].name,
			role: result[0]
		});
	});
});

router.post("/admin/admins/roles/edit/:id/name", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res, next) {
	req.sanitizeBody("name").trim();

	req.checkBody("name").notEmpty().withMessage("Role name can't be empty");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				callback(req.validationErrors()[0].msg);
			else
				callback(null);
		},

		function(callback) {
			db.query("UPDATE admin_roles SET name=? WHERE id=?", [req.body.name, req.params.id], function(err, result) {
				callback(!!err);
			});
		}

	], function(err, result) {
		if(err === true)
			res.flash("danger", "An error occurred, please try again");
		else if(err)
			res.flash("danger", err);
		else
			res.flash("success", "Role name changed");
		res.redirect("/admin/admins/roles/edit/"+req.params.id);

	});
});

router.post("/admin/admins/roles/edit/:id/delete", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res) {
	async.waterfall([

		function(callback) {
			db.query("UPDATE admins SET role=0 WHERE role=?", [req.params.id], function(err, result) {
				callback(err);
			});
		},

		function(callback) {
			db.query("DELETE FROM admin_roles WHERE id=?", [req.params.id], function(err, result) {
				callback(err);
			});
		}

	], function(err) {
		if(err) {
			res.flash("danger", "An error occurred, please try again");
			res.redirect("/admin/admins/roles/edit/"+req.params.id);
		}
		else {
			res.flash("success", "Role deleted");
			res.redirect("/admin/admins/roles");
		}
	});
});

router.post("/admin/admins/roles/edit/:id/flag/:switch", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res) {
	req.sanitizeBody("value").toBoolean();

	db.query("UPDATE admin_roles SET ??=? WHERE id=?", [req.params.switch, req.body.value ? 1 : 0, req.params.id], function(err, result) {
		res.end();
	});
});

router.get("/admin/admins/roles/new", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res) {
	res.render("admin/admins/newrole.html");
});

router.post("/admin/admins/roles/new", middleware.adminShouldBeLoggedIn, middleware.requireFlag("manage_admins"), function(req, res) {
	req.sanitizeBody("name").trim();

	req.checkBody("name").notEmpty().withMessage("Role name can't be empty");

	async.waterfall([

		function(callback) {
			if(req.validationErrors())
				callback(req.validationErrors()[0].msg);
			else
				callback(null);
		},

		function(callback) {
			var colnames = ["name"];
			var values = [req.body.name];
			var cols = 1;

			if(req.body.flag) {
				_.each(req.body.flag, function(value, key) {
					cols++;
					colnames.push(key);
					values.push(1);
				});
			}

			var query = "INSERT INTO admin_roles (" + _.times(cols,_.constant("??")).join(",") + ") VALUES (" + _.times(cols,_.constant("?")).join(",") + ")";

			db.query(query, _.concat(colnames,values), function(err, result) {
				callback(err ? "An error occurred, please try again" : null);
			});
		}

	], function(err) {
		if(err) {
			res.flash("danger", err);
			res.redirect("/admin/admins/roles/new");
		}
		else {
			res.flash("success", "Role created");
			res.redirect("/admin/admins/roles");
		}
	});
});


module.exports = router;