import mongoose from 'mongoose'

/*
interface casa = {
    quarto:string,
    bnheiro:string,
}

let chatuba:casa = {

}
*/
const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
    vida: Number,
    sockid: String,
    nome: String,
    mana: Number,
    stamina: Number,
    run: Number,
    iniciativa: Number,
    nextMove: String,
    nextNextMove: String,
    mid_turn_action: String,
    x: Number,
    y: Number,
    z: Number,
});

const GlobalSchema = new Schema({
    ativo: Number,
    sockid: String,
})



const Player = mongoose.model('player', PlayerSchema) //pessoa JURIDICA
const Global = mongoose.model('global', GlobalSchema) //INSTANCIA
let estrutura  = [Player, Global]
export default estrutura

