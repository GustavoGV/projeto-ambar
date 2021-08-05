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
    level: Number,
    defesaFisica: Number,
    defesaMagica: Number,
    defesaHoly: Number,
    defesaShadow: Number,
    magicLevel: Number,
    classe: String,
    mana: Number,
    stamina: Number,
    forca: Number,
    run: Number,
    iniciativa: Number,
    nextMove: String,
    nextNextMove: String,
    action: String,
    x: Number,
    y: Number,
    z: Number,
    lastRotation: String
});

const GlobalSchema = new Schema({
    ativo: Number,
    sockid: String,
})



const Player = mongoose.model('player', PlayerSchema) //pessoa JURIDICA
const Global = mongoose.model('global', GlobalSchema) //INSTANCIA
let estrutura  = [Player, Global]
export default estrutura

