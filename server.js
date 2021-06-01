import express from 'express' // enviar dados
import http from 'http'
import socketio from 'socket.io'
import mongoose from 'mongoose'
import schema from './schema.js'
const Player = schema[0]
const Global = schema[1] 

// AQUI! == PONTOS QUE precisam de atencao (Da um searach no AQUI! q ta ssafe)

const app = express()
const server = http.createServer(app)
const sockets = socketio(server)

mongoose.connect('mongodb://localhost/aluno_teste') //conexão com o banco de dados

mongoose.connection
    .once('open', () => console.log('Conexao com MongoDB (banco de dados) foi estabelecida com sucesso'))
    .on('error', (error) => {
        console.warn('Falha ao se conectar com o banco de dados. Motivo: ', error)
    })

app.use(express.static('public'))

let actions = []

let sobrenomes = ['gimly','kraus','kramer','cristo','maoemé','geremias','fofopa','perdirtos','santiagos','santifas2']


sockets.on('connection', async (socket) => {
    let np = new Player({
        vida: 100,
        mana: 120,
        nextMove: "stay",
        nextNextMove: "stay",
        stamina: Math.round(10 + 2*Math.random()), //voce pode "correr" (apertando CNTRL (obs: isso apenas antecipa o movimento que ja havia sido setado pelo emit Move do Player)) (ou seja se movimentar tb no meio do turno...) mas gasta um ponto de stamina, q so se regenera com o tempo ou POÇões... (se vc levar um ataque correndo fica uns turnos em STUN... (para penalizar o jogador q abusar das corridas no combate contra NPCs e no PVP...))
        iniciativa: Math.round((500 + 1000*Math.random())),
        x: 0,  
        y: 0,
        z: 0,
        sockid: socket.id,
        nome: 'Jeova'+sobrenomes[Math.round(Math.random()*10)]+Math.round(Math.random()*100),
    })
    await np.save()
    socket.emit('escolhaClasse', np._id)

    console.log(` <=> Player ON. socket.id: ${socket.id}`)

    socket.on('disconnect', async () => {
        console.log(` <=> Cooperativa OFF. socket.id: ${socket.id}`)
        await Player.findOneAndDelete({sockid: socket.id})
    })
    socket.on('action', async (obj) => {
        let a = await Player.findOne({})
    })
    socket.on('classe', async (msg) => {
        if(msg.resp == 'MAGO'){
            let p = await Player.findById({"_id" : msg.id}) //let p = await Player.findById({"_id" : NumberLong(classe.id)})
            p.classe = 'm',
            p.save()
        }
    })
    socket.on('move', async (msg) => {
        let p = await Player.findById({"_id" : msg.id})
        if(p.nextMove == "stay"){
            p.nextMove = msg.resp
            await p.save()
        }
        else if(p.nextMove !== "stay" && p.nextNextMove == "stay"){
            p.nextNextMove = msg.resp
            await p.save()
        }
        
    })
    socket.on('run', async (msg) => {
        let p = await Player.findById({"_id" : msg.id})
        if(p.nextMove !== "stay"){
            p.run = 1
            await p.save()
        }
    })
    socket.on('puxarUpdate', async (msg) => {
        //console.log(msg.id + ' <<puxarUpdate msg.id')
        let p = await Player.findById({"_id" : msg.id})
        let ps = await Player.find()
        let resp = []
        for (let i = 0; i < ps.length; i++) {
            let mod = ps[i].x - p.x
            let modY = ps[i].x - p.y
            if(mod < 0){
                mod = mod*(-1)
            }
            if(modY < 0){
                modY = modY*(-1)
            }
            if(mod < 26 && modY < 26){// (TROCAR PARA 7 esse 20 para ficar no tamanho certo da visao do jogador) AQUI LIMITA AS INFORMAções que chegam para cada players sobre a posição dos outros
                if(ps[i]._id.toString() !== p._id.toString()){
                    resp.push({ //add apenas os outros players visiveis...
                        nome: ps[i].nome,
                        x: ps[i].x,
                        y: ps[i].y,
                        z: ps[i].z,
                        vida: ps[i].vida,
                    })
                }
            }   
        }
        //console.log('update-sent')
        for (let index = 0; index < resp.length; index++) {
            //console.log(resp[index].nome + ' <<resp[i].nome')
            
        }
        //console.log('x >> ' + p.x + ' y >> ' + p.y)
        socket.emit('update', {
            resp: resp,
            x: p.x,
            y: p.y
        })
    })
})
let count = 0
async function intervalFunc() { //mano com esse sistema de turnos dinamicos e globais daria pra de boas n ter o problema grande do LAG pq responder o movimento 1 segundo ou 1,3 segundos depois n alteraria o desfecho final da acao, dando margem para PIngs altos conseguirem ter uma boa experiencia de jogo.. mas tera q ser arquitetada com cautela para fornecer esse depsempenho
    let ps = await Player.find()
    let ar = ps.map((p) => {
        return p.iniciativa
    })
    let indice = ps.map((p) => {
        return {iniciativa: p.iniciativa, id: p._id}
    })
    let fila = ar.sort((a, b) => a - b) 
    let filaP = fila.map((p) => { 

        for (let i = 0; i < indice.length; i++) {
            if(p == indice[i].iniciativa){
                return indice[i].id
            }
            
        }
        
    })
    let psPrioritarios = filaP //lista dos players do com maior iniciativa ate o com a menor iniciativa...
    
    count += 1
    //console.log('meio turno passado (' + count+')')
    if(count%2){

        for(let i = 0; i < psPrioritarios.length; i++){
            let p = await Player.findById({ "_id" : psPrioritarios[i] })
            //console.log('nextMove >>' + p.nextMove)
                let ps = await Player.find()
                let colision = 0
                if(p.nextMove == "w"){
                    for (let c = 0; c < ps.length; c++) {
                        if( ps[c].x == p.x && ps[c].y == p.y - 1){ //checa se a posicao futura do nosso personagem esntrata em colisao com a posicao atual de algum player... (falta as paredes AQUI! )
                            colision = 1
                            p.nextMove = "stay"
                            p.nextNextMove = "stay"
                            p.save()
                            console.log('Blocked ' + p.sockid)
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        console.log('passou w ' + colision)
                        p.y = p.y - 1
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        p.save()
                    }
                    else{
                        sockets.to(p.sockid).emit('moveBlocked')
                    }
                }
                else if(p.nextMove == "s"){
                    for (let c = 0; c < ps.length; c++) {
                        if( ps[c].x == p.x && ps[c].y == p.y + 1){ //checa se a posicao futura do nosso personagem esntrata em colisao com a posicao atual de algum player... (falta as paredes AQUI! )
                            p.nextMove = "stay"
                            p.nextNextMove = "stay"
                            p.save()
                            colision = 1
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        p.y = p.y + 1
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        p.save()
                    }
                    else{
                        sockets.to(p.sockid).emit('moveBlocked')
                    }
                }
                else if(p.nextMove == "a"){
                    for (let c = 0; c < ps.length; c++) {
                        if( ps[c].x == p.x - 1 && ps[c].y == p.y){ //checa se a posicao futura do nosso personagem esntrata em colisao com a posicao atual de algum player... (falta as paredes AQUI! )
                            p.nextMove = "stay"
                            p.nextNextMove = "stay"
                            p.save()
                            colision = 1
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        p.x = p.x - 1
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        p.save()
                    }
                    else{
                        sockets.to(p.sockid).emit('moveBlocked')
                    }
                }
                else if(p.nextMove == "d"){
                    for (let c = 0; c < ps.length; c++) {
                        if( ps[c].x == p.x + 1 && ps[c].y == p.y){ //checa se a posicao futura do nosso personagem esntrata em colisao com a posicao atual de algum player... (falta as paredes AQUI! )
                            p.nextMove = "stay"
                            p.nextNextMove = "stay"
                            p.save()
                            colision = 1
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        p.x = p.x + 1
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        p.save()
                    }
                    else{
                        sockets.to(p.sockid).emit('moveBlocked')
                    }
                }
        }
    }

    sockets.emit('finalTurno')//mandar as infos do q aconteceu no turno 
}
        //rodar aqui as alterações (actions q prevaleceram) no modelo do Jogo e ja dar o Socket de Update...//checar se algum mandou 2 actions pro msm turno dai so considerar a ultima...
    
  
setInterval(intervalFunc, 75);



server.listen(3000, () => {
    console.log(`--> Server escutando porta: 3000`)
})

//laura.campedelli@fgv.br mandar a resenha pra ela

