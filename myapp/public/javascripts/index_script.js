
var default_device_num = "none"
var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
});

var timeout_res = null
var zero_speed_offset = 94
var ffmpeg_rate = 1

$(function() {
    $( "#webcam_image" ).resizable( { ghost: true
     //- helper: "ui-resizable-helper"
     });
});

function stopTimer() {
    console.log("stopping timer");
    clearTimeout(timeout_res);
    timeout_res = null
    $("#start_img_button").attr("disabled", false);
    $("#stop_img_button").attr("disabled", true);
}

function startTimer() {
    if (timeout_res)
    {
        //console.log("Starting get image timer when they are already started")
    }
    else
    {
        console.log("starting get new image timer");
        timeout_res = setTimeout(getNewImage, 2000);
        $("#start_img_button").attr("disabled", true);
        $("#stop_img_button").attr("disabled", false);
    }
}

var imageTimerOk = true
var statusTimerOk = true
var currentStatusImage = "/images/none.jpg"
function setStatusImage(){
    if (imageTimerOk && statusTimerOk && (timeout_res == null))
    {
        if ( currentStatusImage != "/images/yellow.jpg")
        {
            currentStatusImage = "/images/yellow.jpg"
            $("#status_img").attr('src',currentStatusImage);

            console.log("Changing status image to: "+currentStatusImage);
        }
    }
    else if (imageTimerOk && statusTimerOk)
    {
        if ( currentStatusImage != "/images/green.jpg")
        {
            currentStatusImage = "/images/green.jpg"
            $("#status_img").attr('src',currentStatusImage);

            console.log("Changing status image to: "+currentStatusImage);
        }
    }
    else
    {
        if ( currentStatusImage != "/images/red.jpg")
        {
            currentStatusImage = "/images/red.jpg"
            $("#status_img").attr('src',currentStatusImage);

            console.log("Changing status image to: "+currentStatusImage);
        }
    }
    console.log("update status image called: image timer ok: " + imageTimerOk + " status timer ok: " +statusTimerOk + " get new image timer active: "+(timeout_res != null));
}

var imageErrorTimer = null
function restartImageErrorTimer(){
    if (imageErrorTimer != null)
    {
        clearTimeout(imageErrorTimer);
        imageErrorTimer = null
    }
    imageErrorTimer = setTimeout( function(){
        console.log("Error: haven't received image within timeout deadline");
        imageTimerOk = false
        setStatusImage();
    }, 5000);
    imageTimerOk = true
    setStatusImage();
}

var statusErrorTimer = null
function restartStatusErrorTimer(){
    if (statusErrorTimer != null)
    {
        clearTimeout(statusErrorTimer);
        statusErrorTimer = null
    }
    statusErrorTimer = setTimeout( function(){
        console.log("Error: haven't received a 'current status' response within timeout deadline");
        statusTimerOk = false
        setStatusImage();
    }, 3000);
    statusTimerOk = true
    setStatusImage();
}

function processChat(usersList, messagesList){
    $("#message_div").empty();
    for(var i=0; i<usersList.length; i++)
    {
        var toinsert = usersList[i] +" : " +messagesList[i]
        //console.log("inserting: "+toinsert)
        $("<p>"+toinsert+"</p>").appendTo("#message_div")
        //- $('#message_div').html($('#message_div').html()+"<p>"+toinsert+"</p><br>")
    }
}


function getCurentStatus(){
    restartStatusErrorTimer();
    //console.log("get current state called");
    $.post("/",{ get_status: true, uuid: uuid }, function(data, status){
        //console.log("Got response with current state")
        if (status != "success")
        {
            console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
        }
        else
        {
            console.log('current state: '+JSON.stringify(data))
            //console.log(data.pos)
            if (data.ffmpeg_running == null)
            {
                //- do nothing for now. something weird happened
                console.log("ffmpeg is null");
            }
            else if (data.ffmpeg_running)
            {
                //console.log("Already streaming. start callbacks");
                startTimer();
            }
            else if(timeout_res != null)
            {
                //console.log("FFMPEG not streaming. stop timers");
                stopTimer();
            }

            if (data.pos == null)
            {
                console.log("data.pos = null");
            }
            else {
                //console.log("Got current position: "+data.pos);
                $('#speed_slider').val( Number(data.pos) - Number(zero_speed_offset) );
                $('#speed_value_textbox').val($('#speed_slider').val());
            }

            if (data.distance == null)
            {
                console.log("data.distance = null");
            }
            else {
                //console.log("Got current distance: "+data.distance);
                $('#current_distance_text').html( Math.round(data.distance * 100) / 100 );
            }

            if (data.num_users_connected == null)
            {
                console.log("data.num_users_connected = null");
            }
            else {
                //console.log("Got current num_users_connected: "+data.num_users_connected);
                $('#num_connected_text').html( data.num_users_connected );
            }

            if (data.available_video_devices == null)
            {
                console.log("data.device_num = null");
            }
            else
            {
                if (data.current_video_device == null)
                {
                    console.log("data.device_num = null");
                }
                else
                {
                    $("#device_radio_boxes input").css('display', 'none');
                    $("#device_radio_boxes p").css('display', 'none');
                    for (var i=0; i<data.available_video_devices.length; i++)
                    {
                        var devName="/dev/"+data.available_video_devices[i];
                        //console.log('v4l option: '+devName)
                        $("input[name=dev_video_num_radio_group][value=\""+devName+"\"]").css('display', 'inline');
                        $("p:contains(\""+devName+"\")").css('display', 'inline-block');
                    }

                    if ($('input[name="dev_video_num_radio_group"]:checked').length && !data.ffmpeg_running)
                    {
                        $("#start_img_button").attr("disabled", false);
                    }
                    else
                    {
                        $("#start_img_button").attr("disabled", true);
                    }

                    //console.log("Got dev number: "+data.current_video_device);
                    //- $("input[name=dev_video_num_radio_group][value=\""+data.current_video_device+"\"]").attr({ 'checked': true });

                    $("#device_radio_boxes p:contains(\""+data.current_video_device+"\")").css({ 'font-weight': "bold" });
                    $("#device_radio_boxes p:not(:contains(\""+data.current_video_device+"\"))").css({ 'font-weight': "normal" });

                    $("#current_device_num").html(data.current_video_device);
                }
            }

            if (data.usersList.length == data.messagesList.length)
            {
                processChat(data.usersList, data.messagesList)
            }

            restartStatusErrorTimer();
            setTimeout(getCurentStatus, 1000);
        }
    });
}

function updateSpeed()
{
    var speed = $('#speed_value_textbox').val();
    console.log("updating servo speed to: "+speed);
    $.post("/",{ servo_pos: Number(speed) + Number(zero_speed_offset) }, function(data, status){
        if (status != "success")
        {
            console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
        }
    });
}

function getNewImage()
{
    $.post("/",{ get_new_img: true }, function(data, status){
        if (status != "success")
        {
            console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
            timeout_res = null
        }
        else if (data.status == "success")
        {
            $("#webcam_image").attr("src", "data:image/jpeg;base64," + data.data);
            timeout_res = setTimeout(getNewImage, 300);
            restartImageErrorTimer();
        }
        else
        {
            sendStopFFMPEG()
            console.log("error while getting image: error = "+data.data)
        }
    });
}

function sendStartFFMPEG(dev){
    restartImageErrorTimer();
    stopTimer();
    console.log("send ffmpeg start");
    setTimeout(function() {
        $.post("/",{ start_ffmpeg: true, device: dev }, function(data, status){
            if (status != "success")
            {
                console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
            }
            else
            {
                console.log("Successfully started ffmpeg?")
                startTimer()
            }
        });
    }, 500);
}

function sendStopFFMPEG(){
    console.log("send ffmpeg stop");
    if (imageErrorTimer != null)
    {
        clearTimeout(imageErrorTimer);
        imageErrorTimer = null
    }
    stopTimer()
    setTimeout( function(){
        $.post("/",{ stop_ffmpeg: true }, function(data, status){
            if (status != "success")
            {
                console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
            }
        });
    }, 500)
}


var submitMessageTimeout = null
function submitMessage(){
    var username_ = $('#username_textbox').val().trim()
    var message_ = $('#new_message_textbox').val().trim()
    console.log("sending message:" + message_);

    if (username_.length == 0)
    {
        alert("missing username")
        return false
    }
    if ( message_.length == 0)
    {
        alert("missing message text")
        return false
    }


    if (submitMessageTimeout != null)
    {
        clearTimeout(submitMessageTimeout)
        submitMessageTimeout = null
    }

    $('#submit_message').attr( "disabled", true )

    submitMessageTimeout = setTimeout(function(){
        $('#submit_message').attr( "disabled", false )
        alert("Failed to send message!")
    }, 2000)

    $.post("/",{ username: username_, message: message_ }, function(data, status){
        if (status != "success")
        {
            console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
        }
        else
        {
            console.log("Sent successfully");
            $('#new_message_textbox').val("")

            processChat(data.usersList, data.messagesList)
        }

        if (submitMessageTimeout != null)
        {
            clearTimeout(submitMessageTimeout)
            submitMessageTimeout = null
        }
        $('#submit_message').attr( "disabled", false )
    });
    return true
}


$(document).ready( function(){
    $("#start_img_button").attr("disabled", false);
    $("#stop_img_button").attr("disabled", true);
    $("#device_num").val(default_device_num);
    $("#current_device_num").html(default_device_num);
    getCurentStatus();
    for (var i=0; i<9; i++)
    {
        var vidName = "/dev/video"+i;
        $("#device_radio_boxes").append("<p>"+vidName+"</p>")
        $("#device_radio_boxes").append('<input type="radio" name="dev_video_num_radio_group" value="'+vidName+'"></input>')
    }

    $('#new_message_textbox').keypress( function (e) {
      if (e.which == 13) {
        submitMessage()
        return false;
      }
    });

    $('#username_textbox').keypress( function (e) {
      if (e.which == 13) {
        submitMessage()
        return false;
      }
    });

    $('#clear_chat_button').click(function(){
        var res = confirm("Are you sure you want to clear it?")
        if (res == true)
        {
            console.log("clearing chat");

            $.post("/",{ clear_chat: true }, function(data, status){
                if (status != "success")
                {
                    console.log("Error: Data: " + JSON.stringify(data) + " status: "+status);
                }
                else
                {
                    console.log("cleared chat successfully");
                }
            });
        }
    })

    $('#submit_message').click(function(){
        submitMessage()
    })

    $('#stop_img_button').click(function(){
        console.log("stop button clicked");
        $('#webcam_image').attr("src", "/images/paisley.jpg")

        if (timeout_res != null)
        {
            sendStopFFMPEG();
        }

    })

    $('#start_img_button').click(function(){
        if (timeout_res == null)
        {
            //- var dev_num_val = $("#device_num").val();
            var dev_num_val = $('input[name="dev_video_num_radio_group"]:checked').val();

            if (!dev_num_val)
            {
                sendStartFFMPEG(default_device_num, ffmpeg_rate);
            }
            else
            {
                sendStartFFMPEG(dev_num_val, ffmpeg_rate);
                console.log("starting: dev id = "+dev_num_val);
            }
            restartImageErrorTimer();
        }
        else
        {
            console.log("please stop streaming before starting again");
        }
    });

    //- $(document).on('click', '#but', function(){
    //-     updateSpeed()
    //- });
    $('#speed_slider').on('input', function(){
        $('#speed_value_textbox').val($('#speed_slider').val());
        updateSpeed()
    });

    $('#speed_value_textbox').on('input', function(){
        $('#speed_slider').val($('#speed_value_textbox').val());
        updateSpeed()
    });

    $('#stop_button').click(function(){
        $('#speed_value_textbox').val(0);
        //- $('#speed_slider').val(0);
        updateSpeed()
    });

    //SET THE RTSP STREAM ADDRESS HERE
    //- var address = "rtp://127.0.0.1:1234";

    //- var output = '<object width="640" height="480" id="qt" classid="clsid:02BF25D5-8C17-4B23-BC80-D3488ABDDC6B" codebase="http://www.apple.com/qtactivex/qtplugin.cab">';
    //- output += '<param name="src" value="'+address+'">';
    //- output += '<param name="autoplay" value="true">';
    //- output += '<param name="controller" value="false">';
    //- output += '<embed id="plejer" name="plejer" src="/poster.mov" bgcolor="000000" width="640" height="480" scale="ASPECT" qtsrc="'+address+'"  kioskmode="true" showlogo=false" autoplay="true" controller="false" pluginspage="http://www.apple.com/quicktime/download/">';
    //- output += '</embed></object>';

    //- document.getElementById("the_div_that_will_hold_the_player_object").innerHTML = output;
    

})