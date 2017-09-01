//This file will contain the main game
// /*eslint-disable */
// /*global io:true*/
'use strict'
const http = require('http')
const jade = require('jade')
const fs = require('mz/fs')
const io = require('socket.io')
const mongodb = require('mongodb')
const mongo = mongodb.MongoClient
const URL = 'mongodb://localhost:27017/my_database_name'
const ONE = 1
const MINUS_ONE = -1
const GRID_SIZE = 8
const EMPTY = 0
const PLAYER1 = 1
const PLAYER2 = 2
const THREE = 3
const FOUR = 4
const PORT = 8000
const OngoingGames = []
const Sockets = []
let PLAYERS = 0
const directions = [[EMPTY, ONE], [ONE, ONE], [ONE, EMPTY],
                   [ONE, MINUS_ONE], [EMPTY, MINUS_ONE],
                   [MINUS_ONE, MINUS_ONE],
                   [MINUS_ONE, EMPTY], [MINUS_ONE, ONE]]

class Game {
    constructor(player1, player2) {
        this.player1 = player1
        this.player2 = player2
        this.grid = new Array(GRID_SIZE)
        for (let i = 0; i < GRID_SIZE; ++i) {
            this.grid[i] = new Array(GRID_SIZE)
        }
    }
//Initialize the board to starting position
    init() {
        for (let i = 0; i < GRID_SIZE; ++i) {
            for (let j = 0; j < GRID_SIZE; ++j) {
                this.grid[i][j] = EMPTY
            }
        }
        this.grid[THREE][THREE] = PLAYER1; this.grid[THREE][FOUR] = PLAYER2
        this.grid[FOUR][THREE] = PLAYER2; this.grid[FOUR][FOUR] = PLAYER1
    }
    otherPlayer(player) {
        if (player === PLAYER1) {
            return PLAYER2
        }
        return PLAYER1
    }

    isOnBoard(posX, posY) {
        const x = posX >= EMPTY && posX < GRID_SIZE
        const y = posY >= EMPTY && posY < GRID_SIZE
        return x && y
    }

    tilesFlip(posx, posy, xdir, ydir, player) {
        const tileToFlip = []
        const pos = {x: posx + xdir, y: posy + ydir}
        let retval = false
        while (this.isOnBoard(pos.x, pos.y)) {
            if (this.grid[pos.x][pos.y] === player) {
                retval = tileToFlip
                break
            }
            tileToFlip.push([pos.x, pos.y])
            addDirection(pos, xdir, ydir)
        }
        return retval
    }

    validate(player, posX, posY, flag) {
        if (this.grid[posX][posY] !== EMPTY) {
            return false
        }
        const validations = []
        for (let i = 0; i < GRID_SIZE; ++i) {
            validations.push(
                this.validateLine(posX,
                    posY, directions[i][EMPTY], directions[i][ONE], player))
        }
        if (validations.every(element => element ===
            false)) {
            return false
        }
        if (flag) {
            this.grid[posX][posY] = player
        }
        return validations
    }

    move(validations, player) {
        let flip = undefined
        for (let i = 0; i < GRID_SIZE; ++i) {
            if (validations[i] !== false) {
                for (let j = 0; j < validations[i].length; ++j) {
                    flip = validations[i][j]
                    const x = flip[EMPTY]
                    const y = flip[ONE]
                    this.grid[x][y] = player
                }
            }
        }
    }

    getValidMoves(player) {
        const validMoves = []
        for (let i = 0; i < GRID_SIZE; ++i) {
            for (let j = 0; j < GRID_SIZE; ++j) {
                if (this.validate(player, i, j, false) !== false) {
                    validMoves.push([i, j])
                }
            }
        }
        return validMoves
    }

    validateAndMove(player, posX, posY) {
        const validations = this.validate(player, posX, posY, true)
        if (validations === false) {
            return false
        }
        this.move(validations, player)
        return true
    }

    validateLine(posx, posy, xdir, ydir, player) {
        const posX = posx + xdir
        const posY = posy + ydir
        if (this.isOnBoard(posX, posY) && this.grid[posX][posY] ===
        this.otherPlayer(player)) {
            const retval = this.tilesFlip(posX, posY, xdir, ydir, player)
            if (retval !== false) {
                retval.push([posX, posY])
            }
            return retval
        }
        return false
    }

    getPlayer(id) {
        if (this.player1 === id) {
            return PLAYER1
        }
        return PLAYER2
    }

    isOver(player) {
        const p = getPlayer(player)
        const numMoves = this.getValidMoves(p).length
        if (numMoves > EMPTY) {
            return false
        }
        return true
    }
}

mongo.connect(URL, (err, db) => {
    console.log('Connected to MongoDB')
    Promise.all(['reversi_client.js', 'reversi_client.jade'].map(f =>
    fs.readFile(f))).then((data) => {
        const clientHtml = jade.compile(data[ONE])()
        const server = http.createServer((request, response) =>
        response.end(request.url === '/client.js' ? data[EMPTY] : clientHtml))
        const games = db.collection('games')
        const socketio = io(server)
        socketio.sockets.on('connection', socket => {
            if (err) {
                console.log('MonngoDB connection. Error:', err)
                process.exit(ONE)
            }
            let game = undefined
            socket.emit('get_id', '')
            socket.on('got_id', data => {
                if (data === '-1') {
                    const id = '' + ++PLAYERS
                    game = getGameInstance(id)
                    socket.emit('assign_id', id)
                    Sockets[id] = socket
                    console.log(game.grid)
                    console.log('--' + id + '--')
                    games.insert({'id': id, 'grid': game.grid,
                     'player': '-1', 'rank': '-1'}, (err) => {
                        if (err) {
                            console.log('Error')
                        } else {
                            games.update({'id': game.player2},
                            {$set:{'grid': game.grid}})
                            console.log(game.grid)
                            socket.emit('grid', JSON.stringify(game.grid))
                            if (game.player2 !== undefined) {
                                games.update({'id': game.player1},
                                 {$set:{'player': game.player2, 'rank': '1'}})
                                games.update({'id': game.player2},
                                 {$set:{'player': game.player1, 'rank': '2'}})
                                Sockets[game.player1]
                                .emit('starting', 'player1')
                                Sockets[game.player2]
                                .emit('starting', 'player2')
                            }
                            socket.on('on_button_press', data => {
                                if (game !== undefined &&
                                 game.isOver(data) === false) {
                                    if (makeMove(data, socket, game)) {
                                        games.update({'id': game.player1},
                                     {$set:{'grid': game.grid}})
                                        games.update({'id': game.player2},
                                     {$set:{'grid': game.grid}})
                                    }
                                } else if (game !== undefined) {
                                    Sockets[game.player1]
                                    .emit('over', JSON.stringify(game.grid))
                                    Sockets[game.player2]
                                    .emit('over', JSON.stringify(game.grid))
                                    socket.disconnect()
                                }
                            })
                        }
                    })
                } else {
                    Sockets[data] = socket
                    console.log('Player: ' + data + ' connected')
                    games.find({'id': data}).toArray((err, result) => {
                        if (err) {
                            console.log('Error')
                        } else {
                            const p2 = result[EMPTY].player
                            if (p2 !== '-1') {
                                game = twoPlayerGame(data, result, p2)
                            } else {
                                onePlayerGame(data, result)
                            }
                            socket.emit('grid', JSON.stringify(game.grid))
                            console.log(game.grid)
                            console.log('--' + data + '--')
                        }
                        socket.on('on_button_press', data => {
                            if (game.isOver(data) === false) {
                                if (makeMove(data, socket, game)) {
                                    games.update({'id': game.player1},
                                 {$set:{'grid': game.grid}})
                                    games.update({'id': game.player2},
                                 {$set:{'grid': game.grid}})
                                }
                            } else {
                                Sockets[game.player1]
                                .emit('over', JSON.stringify(game.grid))
                                Sockets[game.player2]
                                .emit('over', JSON.stringify(game.grid))
                                socket.disconnect()
                            }
                        })
                    })
                }
            })
        })
        server.listen(PORT, () =>
         console.log('Started listening on localhost:' + PORT))
    })
})

function twoPlayerGame(data, result, p2) {
    if (Sockets[p2] !== undefined) {
        return getGame(p2)
    }
    return secondPlayerArrived(data, result)
}

function secondPlayerArrived(data, result) {
    const game = new Game(undefined, undefined)
    game.grid = result[EMPTY].grid
    if (result[EMPTY].rank === '1') {
        game.player1 = data
        game.player2 = result[EMPTY].player
    } else {
        game.player2 = data
        game.player1 = result[EMPTY].player
    }
    OngoingGames.push(game)
    return game
}

function onePlayerGame(data, result) {
    const game = new Game(data, undefined)
    game.grid = result[EMPTY].grid
    game.player1 = data
    OngoingGames.push(game)
    return game
}

// Get a new game instance or assign player to a game
// that has a single player
function getGameInstance(id) {
    for (let i = 0; i < OngoingGames.length; ++i) {
        if (OngoingGames[i].player2 === undefined) {
            OngoingGames[i].player2 = id
            return OngoingGames[i]
        }
    }
    const myGame = new Game(id, undefined)
    myGame.init()
    OngoingGames.push(myGame)
    return myGame
}


function makeMove(move, player, game) {
    console.log('In make move')
    const p = getPlayer(game, player)
    const moves = move.split(':')[ONE].split('').map(x => parseInt(x))
    const x = moves[EMPTY]; const y = moves[ONE]
    const validations =
    game.validateAndMove(p, x, y)
    if (validations === false) {
        player.emit('invalid', 'Message: Invalid Move made')
        return false
    }
    makeMoveEmits(player, game)
    return true
}

function makeMoveEmits(player, game) {
    const other = getOtherPlayer(player, game)
    if (Sockets[other] === undefined) {
        player.emit('wait')
        return
    }
    player.emit('valid', JSON.stringify(game.grid))
    Sockets[other].emit('turn', JSON.stringify(game.grid))
}

function getPlayer(game, player) {
    const socket1 = Sockets[game.player1]
    if (socket1 === player) {
        return PLAYER1
    }
    return PLAYER2
}

function getOtherPlayer(player, game) {
    const socket1 = Sockets[game.player1]
    if (socket1 === player) {
        return game.player2
    }
    return game.player1
}

function getGame(player) {
    for (let i = 0; i < OngoingGames.length; ++i) {
        if (OngoingGames[i].player1 === player ||
            OngoingGames[i].player2 === player) {
            return OngoingGames[i]
        }
    }
    return undefined
}
function addDirection(pos, x, y) {
    pos.x = pos.x + x
    pos.y = pos.y + y
}

// let myGame = new Game('A', 'B')
// myGame.init()
// const validations = myGame.validate(1, 5, 3)
// myGame.move(validations, 1)
