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
                            actions.push({direction: "w", on: 1, action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, action: "basicAtack", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
                if(p.action == "skill1"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, action: "skill1", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
                if(p.action == "skill2"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, action: "skill2", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                }
                if(p.action == "skill3"){
                    if(p.lastRotation == "w"){
                        if(p.classe == "mago"){
                            actions.push({direction: "w", on: 1, action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y-1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "a"){
                        if(p.classe == "mago"){
                            actions.push({direction: "a", on: 1, action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x-1, p.y, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                    }
                    else if(p.lastRotation == "s"){
                        if(p.classe == "mago"){
                            actions.push({direction: "s", on: 1, action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x, p.y+1, p.z] })
                            console.log(actions)
                            p.action = ""
                            await p.save()
                        }
                        
                    }
                    else if(p.lastRotation == "d"){
                        if(p.classe == "mago"){
                            actions.push({direction: "d", on: 1, action: "skill3", classe: "mago", velocidade: Math.round(p.magicLevel*3), vidaUtil: Math.round(p.magicLevel*4), dano: Math.round(8*p.magicLevel*p.level), nome: p.nome, recemLancada: 1, coordenadas: [p.x+1, p.y, p.z] })
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
        let ps = await Player.find()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                                    await ps.save()
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
                        if(actions[i].coordenadas[1] <= ps[ii].y && actions[i].coordenadas[y] >= actions[i].coordenadas[y] + actions[i].velocidade){
                            if(actions[i].coordenadas[0] == ps[ii].x){
                                ps[ii].vida = ps[ii].vida - actions[i].dano
                                if(ps[ii].vida < 0){
                                    ps[ii].vida = 0
                                    for(let iii = 0; iii < actions.length; iii++){
                                        if(actions[iii].nome == ps[ii].nome){
                                            actions[iii].on = 0
                                        }
                                    }
                                    await ps.save()
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

    sockets.emit('finalTurno')//mandar as infos do q aconteceu no turno 
}
        //rodar aqui as alterações (actions q prevaleceram) no modelo do Jogo e ja dar o Socket de Update...//checar se algum mandou 2 actions pro msm turno dai so considerar a ultima...
    
  
setInterval(intervalFunc, 75);



server.listen(3000, () => {
    console.log(`--> Server escutando porta: 3000`)
})

//laura.campedelli@fgv.br mandar a resenha pra ela

