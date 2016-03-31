var app = require('app')
var bowser = require('browser-window')
var Menu = require('menu')
var MenuItem = require('menu-item')

app.on('ready', function(){
  var window = new bowser({
    width: 1280,
    height: 720
  })
  window.loadUrl('file://' + __dirname + '/public/index.html')
  window.openDevTools()
  var menu = Menu.buildFromTemplate([{
    label: 'options',
    submenu: [{
      label: 'close',
      click: function(){
        app.quit()
      }
    }]
  }])
  Menu.setApplicationMenu(menu)
})

