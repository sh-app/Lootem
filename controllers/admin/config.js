var express = requireMain("express");
var db = requireMain("./utils/database");
var middleware = requireMain("./middleware");
var settings = requireMain("./utils/settings");
var async = requireMain("async");

var router = express.Router();


router.get("/admin/config", middleware.adminShouldBeLoggedIn, middleware.requireFlag("site_config"), function(req, res) {
	settings.getAll(function(err, result) {
		res.render("admin/config.html", result);
	});
});


router.post("/admin/config/withdraw_address", middleware.adminShouldBeLoggedIn, middleware.requireFlag("site_config"), function(req, res) {
	req.sanitizeBody("address").trim();
	req.sanitizeBody("key").trim();

	req.checkBody("address", "Withdraw address can't be empty").notEmpty();
	req.checkBody("key", "You can't change the withdraw address without the private key").notEmpty();

	if(req.validationErrors()) {
		//res.redirect("/admin/config?e="+req.validationErrors()[0].msg);
		res.flash("danger", req.validationErrors()[0].msg);
		res.redirect("/admin/config");
		return;
	}

	async.parallel([
		settings.setWithdrawAddress.bind(null, req.body.address),
		settings.setWithdrawPrivateKey.bind(null, req.body.key)
	], function(err, result) {
		//res.redirect("/admin/config?s=Withdraw address changed");
		res.flash("success", "Withdraw address changed");
		res.redirect("/admin/config");
	});
});

router.post("/admin/config/deposit_address", middleware.adminShouldBeLoggedIn, middleware.requireFlag("site_config"), function(req, res) {

	req.sanitizeBody("address").trim();

	req.checkBody("address", "Deposit address can't be empty").notEmpty();

	if(req.validationErrors()) {
		//res.redirect("/admin/config?e="+req.validationErrors()[0].msg);
		res.flash("danger", req.validationErrors()[0].msg);
		res.redirect("/admin/config");
		return;
	}

	settings.setDepositAddress(req.body.address, function(err, result) {
		//res.redirect("/admin/config?s=Deposit address changed");
		res.flash("success", "Deposit address changed");
		res.redirect("/admin/config");
	});
});

router.post("/admin/config/withdraw_per_day", middleware.adminShouldBeLoggedIn, middleware.requireFlag("site_config"), function(req, res) {
	req.sanitizeBody("limit").trim();

	var limit = parseFloat(req.body.limit);
	if(!limit)
		limit = null;
	else {
		limit *= 100000000;
	}

	settings.setDailyWithdrawLimit(limit, function(err, result) {
		var msg = limit ? "Withdraw limit changed" : "Withdraw limit removed";
		//res.redirect("/admin/config?s="+msg);
		res.flash("success", msg);
		res.redirect("/admin/config");
	});
});

router.post("/admin/config/withdraw_min", middleware.adminShouldBeLoggedIn, middleware.requireFlag("site_config"), function(req, res) {
	req.sanitizeBody("limit").trim();

	var limit = parseFloat(req.body.limit);
	if(!limit)
		limit = null;
	else {
		limit *= 100000000;
	}

	settings.setWithdrawMin(limit, function(err, result) {
		var msg = limit ? "Withdraw limit changed" : "Withdraw limit removed";
		//res.redirect("/admin/config?s="+msg);
		res.flash("success", msg);
		res.redirect("/admin/config");
	});
});

router.post("/admin/config/withdraw_max", middleware.adminShouldBeLoggedIn, middleware.requireFlag("site_config"), function(req, res) {
	req.sanitizeBody("limit").trim();

	var limit = parseFloat(req.body.limit);
	if(!limit)
		limit = null;
	else {
		limit *= 100000000;
	}

	settings.setWithdrawMax(limit, function(err, result) {
		var msg = limit ? "Withdraw limit changed" : "Withdraw limit removed";
		//res.redirect("/admin/config?s="+msg);
		res.flash("success", msg);
		res.redirect("/admin/config");
	});
});


module.exports = router;