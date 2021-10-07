var express = require('express')
var fs = require('fs');
var app = express()
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({
    extended: false
})
app.use(express.static('public'))
app.get('/index', function(req, res) {
    res.sendFile(__dirname + "/" + "index.html")
})
app.get('/', function(req, res) {
    res.send("Welcome to Doctor's Session booking")
})
app.post('/user', urlencodedParser, function(req, res) {
    user = {
        username: req.body.username,
        password: req.body.password
    }
    txt = JSON.stringify(user)
    fs.writeFile('user.txt', txt, function(err) {
        if (err) throw err;
        console.log('user json saved!');
    });
    // res.json(user)
    res.send("<h1> hello " + user.username + "</h1>")
})
var server = app.listen(8081, "0.0.0.0", function() {
    var host = server.address().address
    var port = server.address().port
    console.log('Server is listening at http://%s:%s', host, port);
})