var express = requireMain("express");

var router = express.Router();

router.get("/", function(req, res) {
	res.render("home.html");
});


router.get("/test", function(req, res) {

	

});


module.exports = router;