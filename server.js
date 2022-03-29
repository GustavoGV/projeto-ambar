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
const router = express.Router();

mongoose.connect('mongodb://localhost/aluno_teste') //conexão com o banco de dados

mongoose.connection
    .once('open', () => console.log('Conexao com MongoDB (banco de dados) foi estabelecida com sucesso'))
    .on('error', (error) => {
        console.warn('Falha ao se conectar com o banco de dados. Motivo: ', error)
    })

app.use(express.static('public'))
//
//


let actions = []

let sobrenomes = ['gimly','kraus','kramer','cristo','maoemé','geremias','fofopa','perdirtos','santiagos','santifas2']


sockets.on('connection', async (socket) => {
    let np = new Player({
        vida: 100,
        mana: 120,
        nextMove: "stay",
        nextNextMove: "stay",
        magicLevel: 12,
        level: 8,
        classe: "mago",
        stamina: Math.round(10 + 2*Math.random()), //voce pode "correr" (apertando CNTRL (obs: isso apenas antecipa o movimento que ja havia sido setado pelo emit Move do Player)) (ou seja se movimentar tb no meio do turno...) mas gasta um ponto de stamina, q so se regenera com o tempo ou POÇões... (se vc levar um ataque correndo fica uns turnos em STUN... (para penalizar o jogador q abusar das corridas no combate contra NPCs e no PVP...))
        iniciativa: Math.round((500 + 1000*Math.random())),
        x: 0,  
        y: 0,
        z: 0,
        sockid: socket.id,
        nome: 'Jeova '+sobrenomes[Math.round(Math.random()*10)]+Math.round(Math.random()*100),
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
            await p.save()
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
    socket.on('rotation', async (msg) => {
        let p = await Player.findById({"_id" : msg.id})
        console.log(msg.resp + ' msg.resp')
        if(p){
            if(msg.resp == "w"){
                
                p.lastRotation = "w"
                await p.save()
            }
            if(msg.resp == "a"){
                p.lastRotation = "a"
                await p.save()
            }
            if(msg.resp == "d"){
                p.lastRotation = "d"
                await p.save()
            }
            if(msg.resp == "s"){
                p.lastRotation = "s"
                await p.save()
            }
        }
        
    })
    
    socket.on('run', async (msg) => {
        let p = await Player.findById({"_id" : msg.id})
        if(p.nextMove !== "stay"){
            p.run = 1
            await p.save()
        }
    })
    socket.on('action', async (msg) => { //(fazer de um jeito q nao seja necessario usar o mouse durante um combate!!) TAB (ou SHIFT) + setas ou awsd para rotacionar o personagem parado... para a mao ficar certo nas skills. Apenas tera skills no 1 2 3 e itens usados no 4 e 5.
        let p = await Player.findById({"_id" : msg.id})
        if(msg.resp == "basicAtack"){
            p.action = "basicAtack"
        }
        else if(msg.resp == "skill1"){
            p.action = "skill1"
        }
        else if(msg.resp == "skill2"){
            p.action = "skill2"
        }
        else if(msg.resp == "skill3"){
            p.action = "skill3"
        }
        await p.save()
        
    })
 
    socket.on('puxarUpdate', async (msg) => {
        //console.log(msg.id + ' <<puxarUpdate msg.id')
        let p = await Player.findById({"_id" : msg.id})
        if(p){
        //console.log(p)
        let ps = await Player.find()
        let resp = []
        let actionsState = []
        for (let i = 0; i < ps.length; i++) {
            let modx = ps[i].x - p.x
            let mody = ps[i].x - p.y
            if(modx < 0){
                modx = modx*(-1)
            }
            if(mody < 0){
                mody = mody*(-1)
            }
            if(modx < 2600 && mody < 2600){// (TROCAR PARA 7 esse 20 para ficar no tamanho certo da visao do jogador) AQUI LIMITA AS INFORMAções que chegam para cada players sobre a posição dos outros
                if(ps[i]._id.toString() !== p._id.toString()){
                    resp.push({ //add apenas os outros players visiveis...
                        nome: ps[i].nome,
                        x: ps[i].x,
                        y: ps[i].y,
                        z: ps[i].z,
                        rotation: ps[i].lastRotation,
                        vida: ps[i].vida,
                    })
                }
            }   
        }
        if(actions.length > 0){
            for (let i = 0; i < actions.length; i++){
                let modx = actions[i].coordenadas[0] - p.x
                let mody = actions[i].coordenadas[1] - p.y
                if (modx < 0){
                    modx = modx*(-1)
                }
                if (mody < 0){
                    mody = mody*(-1)
                }
                if(modx < 2600 && mody < 2600){
                    //console.log('11111111111111')
                    //console.log(actions[i])
                    //console.log('11111111111111')
                    actionsState.push({
                        x: actions[i].coordenadas[0],
                        y: actions[i].coordenadas[1],
                        z: actions[i].coordenadas[2],
                        action: actions[i].action,
                        classe: actions[i].classe,
                        id:  actions[i].id,
                        direction: actions[i].direction
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
            actions: actionsState,
            nome: p.nome,
            x: p.x,
            y: p.y,
            z: p.z,
            rotation: p.lastRotation,
            vida: p.vida
        })
    }
    else{
        console.log('let p = await Player.findById({"_id" : msg.id}) returned null')
    }
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
            if(p){
                if(p.vida > 0){
            //console.log('nextMove >>' + p.nextMove)
                let ps = await Player.find()
                let colision = 0

                if(p.nextMove == "w"){
                    for (let c = 0; c < ps.length; c++) {
                        if( ps[c].x == p.x && ps[c].y == p.y - 1){ //checa se a posicao futura do nosso personagem esntrata em colisao com a posicao atual de algum player... (falta as paredes AQUI! )
                            colision = 1
                            p.nextMove = "stay"
                            p.nextNextMove = "stay"
                            await p.save()
                            console.log('Blocked ' + p.sockid)
                            //break //se esse break estiver quebrando a funçao inteira ao inves de so esse For q esta dentro poder ser motivo de um BUG (acho q so da break no for msm...)
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        //console.log('passou w ' + colision)
                        p.y = p.y - 1
                        p.lastRotation = 'w'
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        await p.save()
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
                            await p.save()
                            colision = 1
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        p.y = p.y + 1
                        p.lastRotation = "s"
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        await p.save()
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
                            await p.save()
                            colision = 1
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        p.x = p.x - 1
                        p.lastRotation = "a"
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        await p.save()
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
                            await p.save()
                            colision = 1
                            break
                        }
                    }
                    if(colision !== 1){ //validar se ta livre o sqm...
                        p.x = p.x + 1
                        p.lastRotation = "d"
                        p.nextMove = p.nextNextMove
                        p.nextNextMove = "stay"
                        await p.save()
                    }
                    else{
                        sockets.to(p.sockid).emit('moveBlocked')
                    }
                }

                if(p.action == "basicAtack"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, id: Math.round(10000*Math.random()), action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, id: Math.round(10000*Math.random()), action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, id: Math.round(10000*Math.random()), action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, id: Math.round(10000*Math.random()), action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
                if(p.action == "skill1"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, id: Math.round(10000*Math.random()), action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, id: Math.round(10000*Math.random()), action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, id: Math.round(10000*Math.random()), action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, id: Math.round(10000*Math.random()), action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
                if(p.action == "skill2"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, id: Math.round(10000*Math.random()), action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, id: Math.round(10000*Math.random()), action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, id: Math.round(10000*Math.random()), action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, id: Math.round(10000*Math.random()), action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
                if(p.action == "skill3"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, id: Math.round(10000*Math.random()), action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, id: Math.round(10000*Math.random()), action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, id: Math.round(10000*Math.random()), action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, id: Math.round(10000*Math.random()), action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3/10), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
        
                }
                else{
                p.x = 0
                p.y = 0
                p.vida = 100
                await p.save()
                }
            }
            else{console.log('await Player.findById({ "_id" : psPrioritarios[i] }) returned null')}
        }
        let ps = await Player.find()
        if(ps.length > 0){
        for(let i = 0; i < actions.length; i++){// esse aray de actions tb esta na ordem da maior a menor iniciativa dos players                                                    
            if(actions[i].action == "basicAtack" && actions[i].on == 1){
                
                if(actions[i].classe == "mago"){
                    if(actions[i].direction == "s"){
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[1] <= ps[ii].y && ps[ii].y <= actions[i].coordenadas[1] + actions[i].velocidade){
                                if(actions[i].coordenadas[0] == ps[ii].x){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "w"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[1] >= ps[ii].y && ps[ii].y >= actions[i].coordenadas[1] + actions[i].velocidade){
                                if(actions[i].coordenadas[0] == ps[ii].x){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //desativa a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "a"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[0] >= ps[ii].x && ps[ii].x >= actions[i].coordenadas[0] + actions[i].velocidade){
                                if(actions[i].coordenadas[1] == ps[ii].y){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "d"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[0] <= ps[ii].x && ps[ii].x <= actions[i].coordenadas[0] + actions[i].velocidade){
                                if(actions[i].coordenadas[1] == ps[ii].y){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                }
                else if(actions[i].classe == "guerreiro"){
                    if(actions[i].direction == "s"){
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[1] <= ps[ii].y && ps[ii].y <= actions[i].coordenadas[1] + actions[i].velocidade){
                                if(actions[i].coordenadas[0] == ps[ii].x){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "w"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[1] >= ps[ii].y && ps[ii].y >= actions[i].coordenadas[1] + actions[i].velocidade){
                                if(actions[i].coordenadas[0] == ps[ii].x){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //desativa a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "a"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[0] >= ps[ii].x && ps[ii].x >= actions[i].coordenadas[0] + actions[i].velocidade){
                                if(actions[i].coordenadas[1] == ps[ii].y){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "d"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[0] <= ps[ii].x && ps[ii].x <= actions[i].coordenadas[0] + actions[i].velocidade){
                                if(actions[i].coordenadas[1] == ps[ii].y){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                }
                else if(actions[i].classe == "paladino"){
                    if(actions[i].direction == "s"){
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[1] <= ps[ii].y && ps[ii].y <= actions[i].coordenadas[1] + actions[i].velocidade){
                                if(actions[i].coordenadas[0] == ps[ii].x){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "w"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[1] >= ps[ii].y && ps[ii].y >= actions[i].coordenadas[1] + actions[i].velocidade){
                                if(actions[i].coordenadas[0] == ps[ii].x){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //desativa a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "a"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[0] >= ps[ii].x && ps[ii].x >= actions[i].coordenadas[0] + actions[i].velocidade){
                                if(actions[i].coordenadas[1] == ps[ii].y){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                    else if(actions[i].direction == "d"){
                        
                        for(let ii = 0; ii < ps.length; ii++){
                            if(actions[i].coordenadas[0] <= ps[ii].x && ps[ii].x <= actions[i].coordenadas[0] + actions[i].velocidade){
                                if(actions[i].coordenadas[1] == ps[ii].y){
                                    ps[ii].vida = ps[ii].vida - actions[i].dano//  /ps[ii].defesaMagica
                                    if( ps[ii].vida <= 0){
                                        ps[ii].vida = 0
                                        for(let iii = 0; iii < actions.length; iii++){
                                            if(actions[iii].nome == ps[ii].nome && actions[iii].recemLancada == 1){
                                                actions[iii].on = 0 //deleta a acao recem lancada pq o cara morreu antes de conseguir lancar...
                                            }
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            }
                        }
                    }
                }
            }
        }
        for(let i = 0; i < actions.length; i++){// aqui sim é computado o dano das skills q n foram interrompidas e em seguida suas movimentações
            if(actions[i].action == "interrupt" && actions[i].on == 1){
                
                     //apensa eh possivel dar interrupt no interrupt se vc tiver iniciativa maior
                        if(actions[i].classe == "mago"){
                            if(actions[i].direction == "s"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[1] <= ps[iii].y && ps[iii].y <= actions[i].coordenadas[1] + actions[i].velocidade){
                                        if(actions[i].coordenadas[0] == ps[iii].x){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }     
                            else if(actions[i].direction == "w"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[1] >= ps[iii].y && ps[iii].y >= actions[i].coordenadas[1] + actions[i].velocidade){
                                        if(actions[i].coordenadas[0] == ps[iii].x){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else if(actions[i].direction == "a"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[0] >= ps[iii].x && ps[iii].x >= actions[i].coordenadas[0] + actions[i].velocidade){
                                        if(actions[i].coordenadas[1] == ps[iii].y){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else if(actions[i].direction == "d"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[0] <= ps[iii].x && ps[iii].x <= actions[i].coordenadas[0] + actions[i].velocidade){
                                        if(actions[i].coordenadas[1] == ps[iii].y){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else if(actions[i].classe == "guerreiro"){
                            if(actions[i].direction == "s"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[1] <= ps[iii].y && ps[iii].y <= actions[i].coordenadas[1] + actions[i].velocidade){
                                        if(actions[i].coordenadas[0] == ps[iii].x){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }     
                            else if(actions[i].direction == "w"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[1] >= ps[iii].y && ps[iii].y >= actions[i].coordenadas[1] + actions[i].velocidade){
                                        if(actions[i].coordenadas[0] == ps[iii].x){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else if(actions[i].direction == "a"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[0] >= ps[iii].x && ps[iii].x >= actions[i].coordenadas[0] + actions[i].velocidade){
                                        if(actions[i].coordenadas[1] == ps[iii].y){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else if(actions[i].direction == "d"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[0] <= ps[iii].x && ps[iii].x <= actions[i].coordenadas[0] + actions[i].velocidade){
                                        if(actions[i].coordenadas[1] == ps[iii].y){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else if(actions[i].classe == "paladino"){
                            if(actions[i].direction == "s"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[1] <= ps[iii].y && ps[iii].y <= actions[i].coordenadas[1] + actions[i].velocidade){
                                        if(actions[i].coordenadas[0] == ps[iii].x){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }     
                            else if(actions[i].direction == "w"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[1] >= ps[iii].y && ps[iii].y >= actions[i].coordenadas[1] + actions[i].velocidade){
                                        if(actions[i].coordenadas[0] == ps[iii].x){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else if(actions[i].direction == "a"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[0] >= ps[iii].x && ps[iii].x >= actions[i].coordenadas[0] + actions[i].velocidade){
                                        if(actions[i].coordenadas[1] == ps[iii].y){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else if(actions[i].direction == "d"){
                                for(let iii = 0; iii < ps.length; iii++){
                                    if(actions[i].coordenadas[0] <= ps[iii].x && ps[iii].x <= actions[i].coordenadas[0] + actions[i].velocidade){
                                        if(actions[i].coordenadas[1] == ps[iii].y){
                                            for(let j; j < actions.length; j++){
                                                if(ps[iii].nome == actions[j].nome){
                                                    actions[j].on = 0
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    
                
                
            }
        }
        let spliceActions = []
        for(let i = 0; i < actions.length; i++){
            if(actions[i].recemLancada == 1 && actions[i].on == 1){
                actions[i].recemLancada = 0 // se o autor da açao morrer enquanto sua ação estiver sendo lancada (recemLancada) ela sera interrompida, ou se a acao de outro jogador foi cancelar a ação dele ela sera cancelada (tipo um interrupt)
            }
            
            if(actions[i].on == 1 && actions[i].vidaUtil > 0){
                actions[i].vidaUtil = actions[i].vidaUtil - 1
                if(actions[i].vidaUtil == 0){
                    spliceActions.push(i)
                }

                for(let ii = 0; ii < ps.length; ii++){
                    if(actions[i].direction == "s"){
                        if(actions[i].coordenadas[1] <= ps[ii].y && actions[i].coordenadas[1] >= actions[i].coordenadas[1] + actions[i].velocidade){
                            if(actions[i].coordenadas[0] == ps[ii].x){
                                ps[ii].vida = ps[ii].vida - actions[i].dano
                                if(ps[ii].vida < 0){
                                    ps[ii].vida = 0
                                    for(let iii = 0; iii < actions.length; iii++){
                                        if(actions[iii].nome == ps[ii].nome){
                                            actions[iii].on = 0
                                        }
                                    }
                                    await ps[ii].save()
                                }
                            } 
                        }
                    }
                    else if(actions[i].direction == "w"){}
                }

                if(actions[i].direction == "w"){
                    actions[i].coordenadas[1] = actions[i].coordenadas[1] - actions[i].velocidade
                }
                else if(actions[i].direction == "s"){
                    actions[i].coordenadas[1] = actions[i].coordenadas[1] + actions[i].velocidade
                }
                else if(actions[i].direction == "d"){
                    actions[i].coordenadas[0] = actions[i].coordenadas[0] + actions[i].velocidade
                }
                else if(actions[i].direction == "a"){
                    actions[i].coordenadas[0] = actions[i].coordenadas[0] - actions[i].velocidade
                }


            }
            else{
                spliceActions.push(i)
            }

            
        }
        //await ps.save()
        function spliceA(sa) {
            if(sa.length > 0){
                actions.splice(sa[0],1)
                sa.shift()
                for(let i = 0; i < sa.length; i++){
                    sa[i] = sa[i] - 1
                }
                spliceA(sa)
            }
        } //aqui tira do array de objetos (actions) as ações q ja foram finalizadas/interrompidas
        spliceA(spliceActions)
        }
        else{
            console.log('let ps = await Player.find() returned null')
        }
        
    }

    sockets.emit('finalTurno')//mandar as infos do q aconteceu no turno 
}
        //rodar aqui as alterações (actions q prevaleceram) no modelo do Jogo e ja dar o Socket de Update...//checar se algum mandou 2 actions pro msm turno dai so considerar a ultima...
    
  
setInterval(intervalFunc, 100);



server.listen(3000, () => {
    console.log(`--> Server escutando porta: 3000`)
})

//laura.campedelli@fgv.br mandar a resenha pra ela



 /*
        //detecting double tap keys:
        document.addEventListener("keydown",(e)=>{
            if(controller[e.keyCode]){
                controller[e.keyCode] = true
            }
            handleComand(controller)
        })
        document.addEventListener("keyup",(e)=>{
            if(controller[e.keyCode]){
                controller[e.keyCode] = false
            }
            if(e.keyCode == 16 || e.keyCode == 20){
                handleComand(controller)
            }
            //handleComand(controller)
        })

        function handleComand(cmds) {
            if(cmds[32].estado){//ataque basico
                console.log('ataque basico')
            }
            if(cmds[103].estado || cmds[49].estado){//skill 1

            }
            if(cmds[104].estado || cmds[50].estado){//skill 2

            }
            if(cmds[105].estado || cmds[51].estado){//skill 3

            }
            if(cmds[100].estado || cmds[52].estado){//item 1

            }
            if(cmds[101].estado || cmds[53].estado){//skill 2

            }
            if(cmds[102].estado || cmds[54].estado){//skill 3

            }   

            //movimentação do personagem:
            if((cmds[16].estado || cmds[20].estado) && cmds[87].estado){//virar pra frente
                console.log('virar pra frente')
            }
            else{
                if(cmds[87].estado){//andar pra frente
                    console.log('andar pra frente')
                }
            }
            if((cmds[16].estado || cmds[20].estado) && cmds[68].estado){//virar pra direita
            }
            else{
                if(cmds[68].estado){//andar pra direita

                }
            }
            if((cmds[16].estado || cmds[20].estado) && cmds[65].estado){//virar pra esquerda
            }
            else{
                if(cmds[65].estado){//andar pra esquerda

                }
            }
            if((cmds[16].estado || cmds[20].estado) && cmds[83].estado){//virar pra baixo
            }
            else{
                if(cmds[83].estado){//andar pra baixo

                }
            }

            if((cmds[16].estado || cmds[20].estado) && cmds[38].estado){//virar pra frente
            }
            else{
                if(cmds[38].estado){//andar pra frente

                }
            }
            if((cmds[16].estado || cmds[20].estado) && cmds[39].estado){//virar pra direita
            }
            else{
                if(cmds[39].estado){//andar pra direita

                }
            }
            if((cmds[16].estado || cmds[20].estado) && cmds[37].estado){//virar pra esquerda
            }
            else{
                if(cmds[37].estado){//andar pra esquerda

                }
            }
            if((cmds[16].estado || cmds[20].estado) && cmds[40].estado){//virar pra baixo
            }
            else{
                if(cmds[40].estado){//andar pra baixo

                }
            }

        }
          const controller = {//guarda registro da reclas clicadas
            16: {estado: false},//shift
            20: {estado: false},//tecla: "FIXA embaixo do tab"
            32: {estado: false},//SPACE
            37: {estado: false},//seta Esquerda
            38: {estado: false},//seta Cima
            39: {estado: false},//seta Direita
            40: {estado: false},//seta Baixo
            49: {estado: false},//numeros teclado de cima(1)
            50: {estado: false},//numeros teclado de cima(2)
            51: {estado: false},//numeros teclado de cima(3)
            52: {estado: false},//numeros teclado de cima(4)
            53: {estado: false},//numeros teclado de cima(5)
            54: {estado: false},//numeros teclado de cima(6)
            87: {estado: false},//W
            68: {estado: false},//D
            65: {estado: false},//A
            83: {estado: false},//S
            100: {estado: false},//teclado do lado numeros (4)
            101: {estado: false},//teclado do lado numeros (5)
            102: {estado: false},//teclado do lado numeros (6)
            103: {estado: false},//teclado do lado numeros (7)
            104: {estado: false},//teclado do lado numeros (8)
            105: {estado: false},//teclado do lado numeros (9)

        }
        */