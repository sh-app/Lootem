var db = requireMain("./utils/database");
var _ = requireMain("lodash");

exports.session = function(req, res, next) {
	req.session = {
		loggedin: false
	};

	if(!req.cookies.session)
		return next();

	db.query("SELECT * FROM sessions WHERE id=? AND ip=? AND active=1", [req.cookies.session, req.ip], function(err, result) {
		if(err)
			return next();

		if(!result.length)
			return next();

		var row = result[0];

		req.session.loggedin = true;
		req.session.id = row.id;
		req.session.userid = row.userid;
		req.session.username = row.username;

		next();
	});
}

exports.adminSession = function(req, res, next) {
	req.admin = {
		loggedin: false,
		flags: {}
	}

	if(!req.cookies.admin)
		return next();

	db.query("SELECT * FROM admin_sessions WHERE id=? AND ip=? AND active=1", [req.cookies.admin, req.ip], function(err, result) {
		if(err)
			return next();

		if(!result.length)
			return next();

		var row = result[0];

		req.admin.loggedin = true;
		req.admin.id = row.id;
		req.admin.userid = row.userid;
		req.admin.username = row.username;

		db.query("SELECT admin_roles.* FROM admins INNER JOIN admin_roles ON admins.role=admin_roles.id WHERE admins.id=?", [row.userid], function(err, result) {
			if(err)
				return next();

			if(!result.length)
				return next();

			req.admin.roleid = result[0].id;
			req.admin.rolename = result[0].name;

			_.forEach(result[0], function(value, key) {
				if(key === "id")
					return;
				if(key === "name")
					return;

				req.admin.flags[key] = !!value;
			});

			next();
		});
	});
}

exports.viewData = function(req, res, next) {
	if(req.session.loggedin) {
		res.locals.loggedin = true;
		res.locals.current_userid = req.session.userid;
		res.locals.current_username = req.session.username;
	}
	else {
		res.locals.loggedin = false;
	}

	if(req.admin.loggedin) {
		res.locals.flags = req.admin.flags;
		res.locals.admin_userid = req.admin.userid;
		res.locals.admin_username = req.admin.username;
		res.locals.admin_roleid = req.admin.roleid;
		res.locals.admin_rolename = req.admin.rolename;
		res.locals.hasFlag = function(flag) {
			return !!req.admin.flags[flag];
		}
	}

	next();
}

exports.shouldBeLoggedIn = function(req, res, next) {
	if(req.session.loggedin) {
		next();
		return;
	}

	res.redirect("/");
}

exports.shouldBeLoggedOut = function(req, res, next) {
	if(!req.session.loggedin) {
		next();
		return;
	}

	res.redirect("/");
}

exports.ajaxShouldBeLoggedIn = function(req, res, next) {
	if(req.session.loggedin) {
		next();
		return;
	}

	res.status(400).end();
}

exports.ajaxShouldBeLoggedOut = function(req, res, next) {
	if(!req.session.loggedin) {
		next();
		return;
	}

	res.status(400).end();
}

exports.adminShouldBeLoggedIn = function(req, res, next) {
	if(req.admin.loggedin) {
		next();
		return;
	}

	if(req.xhr)
		res.status(400).end();
	else
		res.redirect("/admin/login");
}

exports.adminShouldBeLoggedOut = function(req, res, next) {
	if(!req.admin.loggedin) {
		next();
		return;
	}

	if(req.xhr)
		res.status(400).end();
	else
		res.redirect("/admin");
}

exports.requireFlag = function(flag) {
	return function(req, res, next) {
		if(req.admin.flags[flag])
			return next();

		if(req.xhr)
			res.status(400).end();
		else
			res.redirect("/admin");
	}
}

exports.hasFlag = function(flag) {
	return !!req.admin.flags[flag];
}