var express = require('express');
var router = express.Router();
var spawn = require('child_process').spawn
var fs_ext = require('fs-ext');
var fs = require('fs')


var last_device_num = 0
var last_pos = 0
var ffmpeg_filename = "/home/shawn/src/remote_control_cat_feeder/myapp/ffmpeg_pics/output.jpg"
var ffmpeg_spawn = null

function start_ffmpeg(device) {
	console.log("starting ffmpeg (device = "+device+")");

	ffmpeg_arg_string = '-i /dev/video' +device+' -r 30 -y -update 1 '+ffmpeg_filename;
	console.log("starting: ffmpeg "+ffmpeg_arg_string);
	if (ffmpeg_spawn == null)
	{
		ffmpeg_spawn = spawn('ffmpeg', ffmpeg_arg_string.split(' '));

		ffmpeg_spawn.stdout.on('data', function (data) {
		  console.log('stdout: ' + data);
		});

		ffmpeg_spawn.stderr.on('data', function (data) {
		  console.log('stderr: ' + data);
		});

		ffmpeg_spawn.on('close', function (code) {
		  console.log('child process exited with code ' + code);
		  ffmpeg_spawn = null
		});
	}
	else
	{
		console.log("Got call to start ffmpeg but it is already running. Restart it")
		ffmpeg_spawn.kill(9)
		ffmpeg_spawn = spawn('ffmpeg', ffmpeg_arg_string.split(' '));
	}
	last_device_num = device
}

function stop_ffmpeg()
{
	if (ffmpeg_spawn)
	{
		console.log("Killing ffmpeg");
		ffmpeg_spawn.kill()
		ffmpeg_spawn = null
	}
	else
	{
		console.log("got call to 'stop' ffmpeg, but it is not running")
	}
}

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
	console.log("Got post: "+JSON.stringify(req.body));

	if (req.body.servo_pos)
	{
		console.log("servo pos received");
		if (servo == null)
		{
			console.log("ERROR: servo is null")

			dict = { status: "failure", data: "servo not inintialized" };
			var json = JSON.stringify(dict)
			res.json(dict);
			return
		}
		else
		{
			pos = req.body.servo_pos
			console.log(pos)
			console.log("setting servo to pos: "+pos);
			last_pos = pos
			servo.to(+pos);
			console.log('got request. position = '+pos);
			// res.write('pos = '+pos);

			dict = { status: "success", data: pos };
			var json = JSON.stringify(dict)
			// res.write(json);
			res.json(dict)
		}
	}
	else if (req.body.get_new_img)
	{
		console.log("new image request received");
		// if ( fd == null )
		// {
		// 	dict = { status: "failed", data: " no file exists at: "+filename+" yet. could not open"};
		// 	console.log(dict)
		// 	res.json(dict)
		// 	return
		// }

		if (ffmpeg_spawn == null)
		{
			//ffmpeg not running
			
			dict = { status: "faliure", data: "ffmpeg not running/failed to start" };
			var json = JSON.stringify(dict)
			// res.write(img); // Send the file data to the browser.
			// res.write(json);
			res.json(dict);
			return
		}
		else
		{
			var fd = fs_ext.openSync(ffmpeg_filename, 'r');
			fs_ext.flock(fd, 'ex', function (err) {
				if (err) {
					console.log("Couldn't lock file");
				}
				// file is locked
				var jpeg_data = fs.readFileSync(ffmpeg_filename);
				var img = new Buffer(jpeg_data, 'binary').toString('base64');

				dict = { status: "success", data: img };
				var json = JSON.stringify(dict)

				// unlock file
				fs_ext.flock(fd, 'un', function(err) {
					if (err) {
						console.log("Couldn't unlock file", counter);
					}
					fs_ext.closeSync(fd);
				})
				// res.write(img); // Send the file data to the browser.
				// res.write(json);
				res.json(dict);
				return
			});
		}
	}
	else if (req.body.start_ffmpeg)
	{
		console.log("starting ffmpeg request received");
		if (req.body.device)
		{
			start_ffmpeg(req.body.device)
		}
		else
		{
			console.log("ERROR: no device ID specified for starting ffmpeg")
		}
		dict = { status: "success", data: "success" };
		var json = JSON.stringify(dict)
		console.log(json)
		// res.write(json);
		res.json(dict);
		return
	}
	else if (req.body.stop_ffmpeg)
	{
		console.log("stopping ffmpeg");
		stop_ffmpeg();
		dict = { status: "success", data: "success" };
		var json = JSON.stringify(dict)
		console.log(json)
		// res.write(json);
		res.json(dict);
		return
	}
	else if (req.body.get_status)
	{
		console.log("Got status request")
		var is_running = (ffmpeg_spawn != null);
		dict = { status: "success", data: "", device_num: last_device_num, ffmpeg_running: is_running, pos: last_pos };
		var json = JSON.stringify(dict)
		console.log(json);
		// res.write(json);
		res.json(dict);
		return
	}
	else{
		res.json({ status: "failure", data: "requeset not containing any valid post data"});
	}
})

module.exports = router;
