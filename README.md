# netsuite-uploader-util
Helper library for uploading files from your local computer into the NetSuite File Cabinet from nodejs.

# Sample gulpfile.js task that leverages this utility:

```javascript
var gulp = require('gulp'),
    watch = require('gulp-watch'),
    nsutil = require('netsuite-uploader-util');

// "Constants"
var watchFilter = 'netsuite_code/**/*.js';
var account = 'TSTDRV1234567';
var role = 3;

gulp.task('default', () => {
    var client = new nsutil.SuiteTalk();
    var creds = nsutil.Credentials;

    console.log('Configuring SuiteTalk client...');
    client.init(creds.email, creds.password, account, role).then(() => {
        console.log('SuiteTalk client configured.');
        console.log('Watching: ' + watchFilter);

        watch(watchFilter, file => {
            console.log(`File changed. Uploading File: ${file.path}...`);
            var pathParts = file.path.split(/\\|\//);
            var idx = pathParts.indexOf('netsuite_code')+1;
            
            var filename = pathParts.slice(idx).join('/');

            var suiteScriptPath = `SuiteScripts/My App/${filename}`;

            client.upload(file.path, suiteScriptPath).then(r=>{
                console.log('  Uploaded File: ' + suiteScriptPath);
            }, err => {
                console.log('  Failed to Upload File: ' + err);
            });
        });
    });
});
```