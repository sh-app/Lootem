var express = requireMain("express");
var db = requireMain("./utils/database");
var settings = requireMain("./utils/settings");
var async = requireMain("async");
var middleware = requireMain("./middleware");

var router = express.Router();

router.use(requireMain("./controllers/admin/login"));
router.use(requireMain("./controllers/admin/home"));
router.use(requireMain("./controllers/admin/config"));
router.use(requireMain("./controllers/admin/admins"));
router.use(requireMain("./controllers/admin/users"));
router.use(requireMain("./controllers/admin/transactions"));


module.exports = router;