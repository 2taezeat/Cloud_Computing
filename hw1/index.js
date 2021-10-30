const async = require('async');
const AWS = require('aws-sdk');
const gm = require('gm');
//const gm = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.
const util = require('util');

// get reference to S3 client 
const s3 = new AWS.S3();
//const transformFunc = process.env.TRANSFORM_FUNC;
const width = process.env.WIDTH_VALUE;
const height = process.env.HEIGHT_VALUE;

 
module.exports.handler = function(event, context, callback) {
    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

    const inputBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const inputKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
      // encodeURIComponent를 통해서 만들어진 URI 이스케이핑을 decode 함.
    const outputBucket = inputBucket + "-output";
    const ouputKey = "output-" + inputKey;
    const params = {
        Bucket: inputBucket,
        Key: inputKey,
    }; 

    // Infer the image type.
    console.log("Finding out the image type");
    const typeMatch = inputKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        callback("Could not determine the image type.");
        return;
    }
    const imageType = typeMatch[1];
    if (imageType != "jpeg" && imageType != "png") {
        callback('Unsupported image type: ${imageType}');
        return;
    }
    console.log("typeMatch : "+ typeMatch);
    console.log("imageType : "+ imageType);

    async.waterfall([
        function download_image(next) {
            // Download the image from S3 into a buffer.
            s3.getObject(params, next);
            },

        function resize_image(response, next) {
            console.log("Resize the image file to width, height value");
            gm(response.Body).resize(width, height)
                .toBuffer(imageType, function(err, buffer) {
                    if (err) {
                        next(err);
                    } else {
                        next(null, response.ContentType, buffer);
                    }
            });

        },
        function upload_image(contentType, data, next) {
            // Stream the transformed image to a different S3 bucket.
            s3.putObject({
                    Bucket: outputBucket,
                    Key: ouputKey,
                    Body: data,
                    ContentType: contentType
                }, next);
            }
        ], function (err) {
            if (err) {
                console.error('Unable to resize, due to an error: ' + err);
            } else {
                console.log('Successfully resized and uploaded');
            }

            callback(null, "message");
        }
    );
};
