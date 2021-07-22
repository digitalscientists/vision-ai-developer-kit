// const Process = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

// A class that sets up a stream server, controls lifetime
// of ffmpeg video streaming
class HlsStream {
    constructor() {
        this.ffmpegProcess = undefined;
    }

    isVideoStreaming() {
        return !!this.ffmpegProcess && !this.ffmpegProcess.killed;
    }

    // Send video stream over the configured camera to the specified streaming port on localhost
    startVideo() {
        if (this.isVideoStreaming()) {
            console.log(`Video is already streaming.`);
            return;
        }

        const rtspIp = process.env.RTSP_IP;
        const rtspPort = process.env.RTSP_PORT;
        const rtspPath = process.env.RTSP_PATH;

        if (!rtspIp || !rtspPort || !rtspPath) {
            console.error(`Necessary environment variables have not been set: RTSP_IP=${rtspIp}, RTSP_PORT=${rtspPort}, RTSP_PATH=${rtspPath}.`);
            return;
        }

        const rtspUrl = `rtsp://${rtspIp}:${rtspPort}/${rtspPath}`;
        console.log(`Converting from RTSP: ${rtspUrl}`);

        const ffmpegParams = `-flags low_delay -rtsp_transport tcp -i ${rtspUrl} -segment_wrap 20 -vsync 0 -copyts -vcodec copy -an -sn -dn -movflags frag_keyframe+empty_moov -f segment -segment_format mpegts -segment_list_flags live -segment_list public/video/index.m3u8 -segment_list_type m3u8 -segment_list_entry_prefix /stream/ public/video/%3d.ts`
        // const ffmpegParams = `-loglevel fatal -i ${rtspUrl} -vcodec copy -an -sn -dn -reset_timestamps 1 -movflags empty_moov+default_base_moof+frag_keyframe -bufsize 256k -f mp4 -seekable 0 -headers Access-Control-Allow-Origin:* -content_type video/mp4 http://127.0.0.1:${this.streamingPort}/${this.secret}`;
        console.log(`Running: ffmpeg ${ffmpegParams}`);

        this.ffmpegProcess = ffmpeg()
          .input(rtspUrl)
          .inputOptions([
            '-rtsp_transport tcp'         
          ])
          .outputOptions([
            '-flags low_delay',
            '-vsync 0',
            '-copyts',
            '-vcodec copy',
            '-an',
            '-sn',
            '-dn',
            '-reset_timestamps 1',
            '-movflags empty_moov+default_base_moof+frag_keyframe',
            '-f segment',
            '-segment_time 1',
            '-segment_wrap 100',
            '-max_delay 5000000',
            '-segment_format mpegts',
            '-segment_list_flags live',
            '-segment_list public/video/index.m3u8', 
            '-segment_list_type m3u8',
            '-segment_list_entry_prefix /stream/'
          ])
          .output('public/video/%3d.ts')          
          .on('error', function(err) {
            console.log('An error occurred: ' + err.message);
          })
          .on('end', function(code, signal) {
            console.log(`Process ffmpeg exited with code ${code} and signal ${signal}.`);
          });
        this.ffmpegProcess.run();

        // Process.spawn('ffmpeg', ffmpegParams.split(' '), {
        //   cwd: process.cwd(),
        //   detached: true,
        //   stdio: "inherit"
        // });
        // this.ffmpegProcess.on('exit', (code, signal) => {
        //     console.log(`Process ffmpeg exited with code ${code} and signal ${signal}.`);
        // });
    }

    // Stop video streaming
    stopVideo() {
        if (!this.ffmpegProcess) {
            console.warn(`Tried to stop video when ffmpeg wasn't known to be running.`);
            return;
        }

        const ffmpegProcess = this.ffmpegProcess;
        this.ffmpegProcess = undefined;
        ffmpegProcess.kill();
        console.log(`Terminated ffmpeg process.`);

        if (process.platform === 'win32') {
            console.log('Running taskkill on ffmpeg to ensure all child processes are closed.');
            Process.exec('taskkill.exe /IM ffmpeg.exe /F');
        }
    }
}

module.exports = HlsStream;