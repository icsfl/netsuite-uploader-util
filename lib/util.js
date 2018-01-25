function log (msg, ex) {
    if (ex) {
        console.log('ERROR: ', msg, ex, '\n', ex.stack);
    }
    else {
        console.log(msg);
    }
}

const fs = require('fs')
function readFileContents(target) {
    return new Promise((resolve, reject)=>{
        fs.readFile(target,  (err, data)=> {
            if(err){
                log('readFileContents'+err); 
                reject(err);
            }
            resolve(new Buffer(data).toString('base64'));
        });
    })
}


function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}



module.exports = {log, readFileContents, getUserHome}; 