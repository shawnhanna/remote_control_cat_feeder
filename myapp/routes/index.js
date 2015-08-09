var express = require('express');
var router = express.Router();

var url = require('url')

var five = require("johnny-five");

var servo = null

five.Board().on("ready", function() {
	servo = new five.Servo(10);
});

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'Cats Cats Cats' });
});

router.post('/', function(req, res, next) {
	console.log("Got post");

	pos = req.body.servo_pos
	console.log(pos)
	if (servo == null)
	{
		console.log("ERROR: servo is null")
		res.end("servo not yet initialized");
		return;
	}

	console.log("setting servo to pos: "+pos);
	servo.to(+pos);
	console.log('got request. position = '+pos);
	res.write('pos = '+pos);
	res.end();
})

module.exports = router;
