var mysql = requireMain("mysql");
var config = requireMain("./config");

var pool = mysql.createPool(config.mysql);

module.exports = pool;