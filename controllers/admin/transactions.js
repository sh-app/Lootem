var express = requireMain("express");
var db = requireMain("./utils/database");
var middleware = requireMain("./middleware");
var async = requireMain("async");
var _ = requireMain("lodash");
var pagination = requireMain("./utils/pagination");

var router = express.Router();

router.get("/admin/transactions", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_transactions"), function(req, res, next) {
	var page = parseInt(req.query.page) || 1;
	var perpage = 20;

	async.waterfall([

		function(callback) {
			db.query("SELECT COUNT(*) as num FROM transactions", function(err, result) {
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
			db.query("SELECT *,CAST(ROUND(amount/100000000,8) AS CHAR) AS amount,DATE_FORMAT(time, '%Y-%m-%d %H:%i:%s') AS time FROM transactions ORDER BY time DESC LIMIT ?,?", [(page-1)*perpage, perpage], function(err, result) {
				callback(err, pag, result);
			});
		}

	], function(err, pag, tx) {
		if(err)
			next(err);

		res.render("admin/transactions/all.html", {
			transactions: tx,
			pagination: pag
		});
	});
});

router.get("/admin/transactions/requested", middleware.adminShouldBeLoggedIn, middleware.requireFlag("user_transactions"), function(req, res, next) {
	var page = parseInt(req.query.page) || 1;
	var perpage = 20;

	async.waterfall([

		function(callback) {
			db.query("SELECT COUNT(*) as num FROM transactions WHERE status='Requested'", function(err, result) {
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
			db.query("SELECT *,CAST(ROUND(amount/100000000,8) AS CHAR) AS amount,DATE_FORMAT(time, '%Y-%m-%d %H:%i:%s') AS time FROM transactions WHERE status='Requested' ORDER BY time DESC LIMIT ?,?", [(page-1)*perpage, perpage], function(err, result) {
				callback(err, pag, result);
			});
		}

	], function(err, pag, tx) {
		if(err)
			next(err);

		res.render("admin/transactions/requested.html", {
			transactions: tx,
			pagination: pag
		});
	});
});

module.exports = router;