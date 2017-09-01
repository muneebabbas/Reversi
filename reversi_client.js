/*global io $*/
const GRID_SIZE = 8
const ZERO = 0
const ONE = 1
const TWO = 2
let GRID = undefined
let myTurn = false
let player = undefined
let ID = '-1'
$(() => {
    const socketio = io()
    setEventHandlers()
    socketio.on('grid', data => {
        GRID = JSON.parse(data)
        updateButtons(GRID)
    })

    socketio.on('valid', data => {
        myTurn = false
        GRID = JSON.parse(data)
        updateButtons(GRID)
        $('#message').text('Message: Your oponnents turn')
    })
    socketio.on('turn', data => {
        myTurn = true
        $('#message').text('Message: Your Turn Now')
        GRID = JSON.parse(data)
        updateButtons(GRID)
    })

    socketio.on('get_id', () => socketio.emit('got_id', ID))
    socketio.on('over', data => {
        updateButtons(JSON.parse(data))
        gameEnded(JSON.parse(data))
    })

//=========================================================================
// Function to set hook buttonPress event handlers
//=========================================================================
    function setEventHandlers() {
        for (let i = 0; i < GRID_SIZE; ++i) {
            for (let j = 0; j < GRID_SIZE; ++j) {
                $('#m' + i + j).click(() => {
                    if (myTurn) {
                        socketio.emit('on_button_press', ID + ':' + i + j)
                    } else {
                        $('#message').text('Error: It is not your turn')
                    }
                })
            }
        }
        socketio.on('starting', data => {
            let color = ''
            if (data === 'player1') {
                myTurn = true
                player = 1
                color = 'Black'
                $('#message').text('Your Turn')
            } else {
                player = 2
                color = 'Blue'
            }
            $('#status').text('Status: Game Started Your Color: ' + color)
        })
        socketio.on('invalid', data => $('#message').text(data))
        socketio.on('assign_id', data => {
            $('#id').text('ID: ' + data)
            ID = data
        })
        socketio.on('wait', () =>
         $('message').text('Other player Not connected'))
    }

//=========================================================================
// Function to update the buttons
//=========================================================================
    function updateButtons(grid) {
        let score = 0
        for (let i = 0; i < GRID_SIZE; ++i) {
            for (let j = 0; j < GRID_SIZE; ++j) {
                if (grid[i][j] === ONE) {
                    $('#m' + i + j).attr('style', 'background-color:black')
                } else if (grid[i][j] === TWO) {
                    $('#m' + i + j).attr('style', 'background-color:#3F51B5')
                } else if (grid[i][j] === ZERO) {
                    $('#m' + i + j).html('')
                }
                if (grid[i][j] === player) {
                    score = score + ONE
                }
            }
        }
        $('#score').text('Score: ' + score)
    }
//=========================================================================
// Game Ended
//=========================================================================
    function gameEnded(grid) {
        let player = 0
        let oponnent = 0
        for (let i = 0; i < GRID_SIZE; ++i) {
            for (let j = 0; j < GRID_SIZE; ++j) {
                if (grid[i][j] === player) {
                    player = player + ONE
                } else {
                    oponnent = oponnent + ONE
                }
            }
        }
        if (player > oponnent) {
            $('#message').text('You Won')
        } else {
            $('#message').text('You Lose')
        }
    }
})
