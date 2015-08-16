var express = require('express');
var router = express.Router();
var spawn = require('child_process').spawn
var fs_ext = require('fs-ext');
var fs = require('fs')
//var url = require('url')
var five = require("johnny-five");

// ffmpeg stuff
var last_device_num = "none"
var last_pos = 94
var ffmpeg_filename = "/home/pi/src/remote_control_cat_feeder/myapp/public/images/output.jpg"
var ffmpeg_spawn = null

// johnny five stuff
var board = null
var servo = null
var proximity = null
var distanceAvg = 0

// users and other vars
var connectedUsersTimeouts = new Object();
var usersList = []
var messagesList = []
var files = processSlashDev(fs.readdirSync("/dev"))
var get_files_timer = null

function processSlashDev(files_){
    newFiles = []
    var re = /video[0-9]/
    for (i = 0; i < files_.length; i++) {
        if (files_[i].match(re))
            newFiles.push(files_[i])
    }
    // console.log(newFiles)
    return newFiles
}

function getValidVideoIndexes(){
    files = fs.readdirSync("/dev")
    files = processSlashDev(files)
    console.log("valid '/dev/video' drivers: "+files)
    if (get_files_timer != null)
    {
        clearTimeout(get_files_timer)
    }
    get_files_timer = setTimeout(getValidVideoIndexes, 10000)
}

var ffmpeg_data_timeout = null
function start_ffmpeg(device, rate) {
    console.log("starting ffmpeg (device = "+device+")");
    ffmpeg_arg_string = '-f v4l2 -i ' +device+' -r '+rate+' -y -update 1 '+ffmpeg_filename;
    console.log("starting: ffmpeg "+ffmpeg_arg_string);
    if (ffmpeg_spawn == null)
    {
        ffmpeg_arg_string =  '-f v4l2 -i /dev/video0 -r 1 -y -update 1 ' + ffmpeg_filename

        ffmpeg_spawn = spawn('/home/pi/ffmpeg', ffmpeg_arg_string.split(' '));

        // ffmpeg_spawn.stdout.on('data', function (data) {
        //   console.log('stdout: ' + data);
        // });

        ffmpeg_spawn.stderr.on('data', function (data) {
          if (ffmpeg_data_timeout != null)
          {
              clearTimeout(ffmpeg_data_timeout)
          }
          ffmpeg_data_timeout = setTimeout( function(){
              console.log("ERROR: No data coming from ffmpeg. Stop it?");
              stop_ffmpeg();
          }, 3000)
          console.log('stderr: ' + data);
        });

        ffmpeg_spawn.on('close', function (code) {
            console.log('child process exited with code ' + code);
            ffmpeg_spawn = null
            last_device_num = "none"
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
    last_device_num = "none"
}

// function closeAruinoBoard()
// {
//     board = null
//     servo = null
//     proximity = null
// }

function initArduinoBoard()
{
    console.log("Starting up arduino");
    // try{
        board = new five.Board();
        board.on("ready", function(error) {
            if (error)
            {
                console.log("j5 error: "+error)
                return
            }
            servo = new five.Servo(10);

            // proximity = new five.Proximity({
            //     controller: "HCSR04",
            //     pin: 7
            // });

            // proximity.on("data", function() {
            //     distanceAvg = distanceAvg * 0.8 + this.cm * 0.2
            // });

            // Creates a piezo object and defines the pin to be used for the signal
        /*    var piezo = new five.Piezo(3);

            // Injects the piezo into the repl
            board.repl.inject({
                piezo: piezo
            });

            // Plays a song
            piezo.play({
                // song is composed by an array of pairs of notes and beats
                // The first argument is the note (null means "no note")
                // The second argument is the length of time (beat) of the note (or non-note)
                song: [
                    ["C4", 1 / 4],
                    ["D4", 1 / 4],
                    ["F4", 1 / 4],
                    ["D4", 1 / 4],
                    ["A4", 1 / 4],
                    [null, 1 / 4],
                    ["A4", 1],
                    ["G4", 1],
                    [null, 1 / 2],
                    ["C4", 1 / 4],
                    ["D4", 1 / 4],
                    ["F4", 1 / 4],
                    ["D4", 1 / 4],
                    ["G4", 1 / 4],
                    [null, 1 / 4],
                    ["G4", 1],
                    ["F4", 1],
                    [null, 1 / 2]
                ],
                tempo: 30
            });

            // Plays the same song with a string representation
            piezo.play({
                // song is composed by a string of notes
                // a default beat is set, and the default octave is used
                // any invalid note is read as "no note"
                song: "C D F D A - A A A A G G G G - - C D F D G - G G G G F F F F - -",
                beats: 1 / 4,
                tempo: 100
            });*/
        });
    // }
    // catch(e)
    // {
    //     console.log("Error opening arduino: "+e);
    // }
}

function no_more_users(){
    if (get_files_timer != null)
    {
        clearTimeout(get_files_timer)
        get_files_timer = null
    }
    // closeAruinoBoard()
    stop_ffmpeg();
}

initArduinoBoard();
function first_user_connected(){
    if (get_files_timer == null)
    {
        getValidVideoIndexes();
    }
}

function gotUser(uuid)
{
    if (Object.keys(connectedUsersTimeouts).length == 0)
    {
        // no more users. stop things that aren't needed
        first_user_connected()
    }
    if (uuid in connectedUsersTimeouts)
    {
        clearTimeout(connectedUsersTimeouts[uuid])
    }
    connectedUsersTimeouts[uuid] = setTimeout( function(){
        delete connectedUsersTimeouts[uuid]
        if (Object.keys(connectedUsersTimeouts).length == 0)
        {
            // no more users. stop things that aren't needed
            no_more_users();
        }
    }, 2100);
}

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
        //  dict = { status: "failed", data: " no file exists at: "+filename+" yet. could not open"};
        //  console.log(dict)
        //  res.json(dict)
        //  return
        // }

        if (ffmpeg_spawn == null)
        {
            //ffmpeg not running
            console.log("ffmpeg not running")
            
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
                    res.json( { status: "failure", data: " Couldn't lock file" } )
                    return
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
                        dict.status = failure
                        dict.data = "couldn't unlock file"
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
            if (req.body.rate != null && req.body.rate > 0)
            {
                start_ffmpeg(req.body.device, req.body.rate)
            }
            else
            {
                start_ffmpeg(req.body.device, 15)
            }
        }
        else
        {
            console.log("ERROR: no device ID specified for starting ffmpeg")
        }

        if (ffmpeg_spawn != null)
        {
            dict = { status: "success", data: "success" };
        }
        else
        {
            dict = { status: "failure", data: "couldn't start video on device: "+req.body.device}
        }
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
        var uuid = req.body.uuid
        gotUser(uuid);
        console.log("Got status request from: "+uuid)
        var is_running = (ffmpeg_spawn != null);
        dict = { status: "success", data: "", messagesList: messagesList, usersList: usersList, current_video_device: last_device_num, ffmpeg_running: is_running, pos: last_pos, distance: distanceAvg, num_users_connected: Object.keys(connectedUsersTimeouts).length, available_video_devices: files };
        var json = JSON.stringify(dict)
        console.log(json);
        // res.write(json);
        res.json(dict);
        return
    }
    else if (req.body.message != null && req.body.username != null)
    {
        console.log("got a new message from user ("+req.body.username+"): "+req.body.message)
        usersList.push(req.body.username)
        messagesList.push(req.body.message)
        dict = { status: "success", data: "success", messagesList: messagesList, usersList: usersList };
        res.json(dict);
        return
    }
    else if (req.body.clear_chat)
    {
        console.log("got a new message from user ("+req.body.username+"): "+req.body.message)
        usersList = []
        messagesList = []
        dict = { status: "success", data: "success" };
        res.json(dict);
        return
    }
    else{
        res.json({ status: "failure", data: "requeset not containing any valid post data"});
    }
})

module.exports = router;
