function openPopup(selector) {
	var bg = $("#popup-background");
	var popup = $(selector);

	$(".popup").fadeOut();

	if(!bg.is(":visible"))
		bg.fadeIn();

	popup.fadeIn();
}

function closePopup() {
	$(".popup").fadeOut();
	$("#popup-background").fadeOut();
}

$(".close-popup").click(function() {
	closePopup();
	return false;
});

$("#popup-background").click(function() {
	closePopup();
	return false;
});


/**
 * Popup opener links/buttons
 */

$(".deposit-qr").click(function() {
	var address = $("#deposit-address").text();

	$("#deposit-qr-addr").text(address);
	$("#deposit-qr-img").attr("src", "https://blockchain.info/qr?data=" + address + "&size=300");

	openPopup("#deposit-qr-popup");

	return false;
});


$(".login-popup-link").click(function() {
	$("#login-error").hide();
	openPopup("#login-popup");
});

$(".signup-popup-link").click(function() {
	$("#signup-error").hide();
	openPopup("#signup-popup");
});

$(".forgot-password-popup-link").click(function() {
	$("#forgot-error").hide();
	$("#forgot-success").hide();
	openPopup("#forgot-popup");
});

$(".change-password-popup-link").click(function() {
	$("#change-password-error").hide();
	$("#change-password-success").hide();
	openPopup("#change-password-popup");
});

$(".change-defaultbtc-popup-link").click(function() {
	$("#change-defaultbtc-error").hide();
	$("#change-defaultbtc-success").hide();
	openPopup("#change-defaultbtc-popup");
});


/**
 * Popup form submission handling
 */
$("#login-popup form").submit(function() {
	var data = {
		username: $("#login-username-input").val(),
		password: $("#login-password-input").val()
	};

	$("#login-error").slideUp("fast");

	$.post("/ajax/login", data, "json")
	.done(function(result) {
		window.location.href = "/";
	})
	.fail(function(result) {
		if(result.responseJSON.error)
			$("#login-error").text(result.responseJSON.error).slideDown("fast");
	});

	return false;
});

$("#signup-popup form").submit(function() {
	var data = {
		username: $("#signup-username-input").val(),
		password: $("#signup-password-input").val(),
		password2: $("#signup-password2-input").val(),
		email: $("#signup-email-input").val(),
		email2: $("#signup-email2-input").val(),
		defaultBTC: $("#signup-btc-input").val()
	}

	$("#signup-error").slideUp("fast");

	$.post("/ajax/signup", data, "json")
	.done(function(result) {
		window.location.href = "/";
	})
	.fail(function(result) {
		if(result.responseJSON.error)
			$("#signup-error").text(result.responseJSON.error).slideDown("fast");
	});

	return false;
});

$("#forgot-popup form").submit(function() {
	var data = {
		email: $("#forgot-email-input").val()
	}

	$("#forgot-error").slideUp("fast");
	$("#forgot-success").slideUp("fast");

	$.post("/ajax/resetpass", data, "json")
	.done(function(result) {
		$("#forgot-success").text(result.message).slideDown("fast");

		$("#forgot-email-input").val("");
	})
	.fail(function(result) {
		if(result.responseJSON.error)
			$("#forgot-error").text(result.responseJSON.error).slideDown("fast");
	});

	return false;
});

$("#change-password-popup form").submit(function() {
	var data = {
		oldpassword: $("#change-password-old-password-input").val(),
		password: $("#change-password-password-input").val(),
		password2: $("#change-password-password2-input").val()
	}

	$("#change-password-error").slideUp("fast");
	$("#change-password-success").slideUp("fast");

	$.post("/ajax/changepass", data, "json")
	.done(function(result) {
		$("#change-password-success").text(result.message).slideDown("fast");

		$("#change-password-old-password-input").val("");
		$("#change-password-password-input").val("");
		$("#change-password-password2-input").val("");
	})
	.fail(function(result) {
		if(result.responseJSON.error)
			$("#change-password-error").text(result.responseJSON.error).slideDown("fast");
	});

	return false;
});

$("#change-defaultbtc-popup form").submit(function() {
	var data = {
		password: $("#change-defaultbtc-password-input").val(),
		btc: $("#change-defaultbtc-btc-input").val()
	}

	$("#change-defaultbtc-error").slideUp("fast");
	$("#change-defaultbtc-success").slideUp("fast");

	$.post("/ajax/changedefaultbtc", data, "json")
	.done(function(result) {
		$("#change-defaultbtc-success").text(result.message).slideDown("fast");

		$("#profile-defaultbtc").text(result.btc ? result.btc : "None");

		$("#change-defaultbtc-password-input").val("");
		$("#change-defaultbtc-btc-input").val("");
	})
	.fail(function(result) {
		if(result.responseJSON.error)
			$("#change-defaultbtc-error").text(result.responseJSON.error).slideDown("fast");
	});

	return false;
});

