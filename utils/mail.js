var api_key = "key-b0b8852561643acd57e32dfe02d3b018";
var domain = "sandbox4c349212050248f29c6d6ce48829fb2c.mailgun.org";

var mailgun = requireMain("mailgun-js")({
	apiKey: api_key,
	domain: domain
});

var from_name = "Bitcoin Gamling";
var from_mail = "example@sandbox4c349212050248f29c6d6ce48829fb2c.mailgun.org";

function composeFrom(arg1, arg2) { // arg1 = name | email, arg2 = email
	if(!arg2)
		return arg1;
	if(!arg1)
		return arg2;
	return arg1 + " <" + arg2 + ">";
}

exports.sendSingle = function(to, subject, message) {
	mailgun.messages().send({
		from: composeFrom(from_name, from_mail),
		to: to,
		subject: subject,
		text: message
	}, function(err, body) {
		console.log(body);
	});
}