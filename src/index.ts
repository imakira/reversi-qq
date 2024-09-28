import { Bot, Intent } from 'qq-official-bot';
import { APPID, SECRET } from './config';


const testConfig = {
  appid: APPID,
  secret: SECRET,
  sandbox: false,
  intents: <Intent[]>[
    'GROUP_AT_MESSAGE_CREATE',
    'C2C_MESSAGE_CREATE',
    'DIRECT_MESSAGE',
  ],
};

enum Piece { EMPTY, WHITE, BLACK };
type Position = [number, number];

function arrayEqual<T>(array1: Array<T>, array2: Array<T>) {
  return array1.length === array2.length && array1.every(function (value, index) { return value === array2[index] });
}

function dedup<T>(a: Array<T>) {
  return a.sort().filter(function (item, pos, ary) {
    let diff = false;
    if (Array.isArray(item) && Array.isArray(ary[pos - 1])) {
      diff = !arrayEqual(item, <Array<any>>ary[pos - 1])
    } else {
      diff = item !== ary[pos - 1];
    }
    return !pos || diff;
  });
}

function abs(a: number) {
  if (a < 0) {
    a = 0 - a;
  }
  return a;
}

let DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]
  , [1, 1], [-1, -1], [1, -1], [-1, 1]];
export class Reversi {
  board: Array<Array<Piece>>;
  nextStep: Piece;
  constructor(public width = 8) {
    if (width % 2 != 0) {
      throw new Error("width must be an even number");
    }
    this.board = Array.from(new Array(width), (_) => Array.from(new Array(width), (_) => Piece.EMPTY));
    this.board[width / 2 - 1][width / 2 - 1] = Piece.WHITE;
    this.board[width / 2][width / 2] = Piece.WHITE;
    this.board[width / 2][width / 2 - 1] = Piece.BLACK;
    this.board[width / 2 - 1][width / 2] = Piece.BLACK;
    this.nextStep = Piece.BLACK;
  }
  public nextStepToEmoji(){
    return this.nextStep == Piece.BLACK ? "⚫" : "⚪";
  }
  isLegible(p: Position) {
    let x = p[0];
    let y = p[1];
    if (x < 0 || x >= this.width || y < 0 || y >= this.width) {
      return false;
    };
    return true;
  }
  private extend(x: number, y: number): Array<Position> {
    let feasibles: Array<Position> = [];
    for (let dir of DIRECTIONS) {
      let i = x, j = y;
      let oppoInBetween = false;
      while (true) {
        i += dir[0];
        j += dir[1];
        if (!this.isLegible([i, j])) {
          break;
        }
        let color = this.board[i][j];
        if (!oppoInBetween && color == Piece.EMPTY) {
          break;
        }
        if (oppoInBetween && color != Piece.EMPTY && color == this.nextStep) {
          break;
        }
        if (color != Piece.EMPTY && color != this.nextStep) {
          oppoInBetween = true;
        }
        if (oppoInBetween && color == Piece.EMPTY) {
          feasibles.push([i, j]);
          break;
        }
      }
    }
    return feasibles;
  }
  feasibleSteps(): Array<Position> {
    let result: Array<Position> = [];
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.width; j++) {
        if (this.board[i][j] == this.nextStep) {
          let feasibles = this.extend(i, j);
          result = result.concat(feasibles);
        }
      }
    }
    return dedup(result);
  }

  isFinished(): boolean {
    return this.feasibleSteps().length == 0;
  }

  private flip(p1: Position, p2: Position) {
    if (!(this.isLegible(p1) && this.isLegible(p2))) {
      throw new Error("some of the positions are not valid");
    }
    let deltaX = 0;
    if (p1[0] > p2[0]) {
      deltaX = -1;
    }
    if (p1[0] < p2[0]) {
      deltaX = 1;
    }
    let deltaY = 0;
    if (p1[1] > p2[1]) {
      deltaY = -1;
    }
    if (p1[1] < p2[1]) {
      deltaY = 1;
    }
    let x = p1[0];

    let y = p1[1];
    x += deltaX;
    y += deltaY;
    do {
      if (this.board[x][y] == Piece.WHITE) {
        this.board[x][y] = Piece.BLACK;
      } else {
        this.board[x][y] = Piece.WHITE;
      }
      x += deltaX;
      y += deltaY;
    } while (x != p2[0] || y != p2[1])
  }
  private assertPlaceable(x: number, y: number) {
    if (x < 0 || x >= this.width || y < 0 || y > this.width) {
      throw new Error("step out of bound");
    };
    if (this.board[x][y] != Piece.EMPTY) {
      throw new Error("place has already been taken");
    }
    let feasibles = this.feasibleSteps();
    let valid = feasibles.filter((item) => arrayEqual(item, [x, y])).length >= 1;
    if (!valid) {
      throw new Error(`You can't place a piece at ${x}, ${y}`);
    }
  }
  step(x: number, y: number) {
    this.assertPlaceable(x, y);
    let ctcs = this.contacts([x, y]);
    for (let contact of ctcs) {
      this.flip([x, y], contact);
    }
    this.board[x][y] = this.nextStep;
    if (this.nextStep == Piece.WHITE) {
      this.nextStep = Piece.BLACK;
    } else {
      this.nextStep = Piece.WHITE;
    }
  }
  public value(x: number, y: number): number {
    this.assertPlaceable(x, y);
    let ctcs = this.contacts([x, y]);
    let value = 0;
    for (let contact of ctcs) {
      value = value + abs(contact[0] - x);
      if (value == 0) {
        value = value + abs(contact[1] - y);
      }
    }
    return value;
  }

  public bestStep(): Position {
    if (this.isFinished()) {
      throw new Error("The game is already finished");
    }
    let positionToValueMap: Array<[Position, number]> = this.feasibleSteps().map((item) => {
      let [x, y] = item;
      return [item, this.value(x, y)]
    })
    let m = positionToValueMap[0];
    for (let i of positionToValueMap) {
      if (i[1] > m[1]) {
        m = i;
      }
    }
    return m[0];
  }

  contacts(p: Position) {
    let results = [];
    for (let dir of DIRECTIONS) {
      let x = p[0]
      let y = p[1]
      let oppoInBetween = false;
      while (true) {
        x = x + dir[0];
        y = y + dir[1];
        if (!this.isLegible([x, y])) {
          break;
        }
        let color = this.board[x][y];
        if (color == Piece.EMPTY) {
          break;
        }
        if (color != this.nextStep) {
          oppoInBetween = true;
        }
        if (oppoInBetween && color == this.nextStep) {
          results.push([x, y]);
          break;
        }
      }
    }
    return results;
  }
  public printBoardToString(): string {
    let feasibles = this.feasibleSteps();
    let isFeasibles = (x, y) => {
      return feasibles.filter((item) => arrayEqual(item, [x, y])).length >= 1;
    }
    let result = "";
    let emojiNumbers =  ["⏹️", "1️⃣", "2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"];
    result+=emojiNumbers.join("") + "\n";
    for (let i = 0; i < this.width; i++) {
      result += emojiNumbers[i+1]+ this.board[i].map((item, index) => {
        if (item == Piece.EMPTY) {
          if (isFeasibles(i, index)) {
            return "➕";
          } else {
            return "⬜";
          }
        } else if (item == Piece.BLACK) {
          return "⚫";
        } else {
          return "⚪"
        }
      }).join("") + "\n";
    }
    return result;
  }
  public printBoard(){
    console.log(this.printBoardToString());
  }
  public score(): [number, number]{
    let white = 0, black = 0;
    for(let i = 0; i < this.width; i++){
      for(let j =0; j < this.width; j++){
        if(this.board[i][j]==Piece.WHITE){
          white++;
        }else if(this.board[i][j]==Piece.BLACK){
          black++;
        }
      }
    }
    return [white, black];
  }
}

import readline from 'readline';
async function play() {
  let r = new Reversi();
  r.printBoard();
  console.log(r.feasibleSteps());
  console.log("current step is: ", (r.nextStep == Piece.BLACK ? "⚫" : "⚪"))
  for await (const line of readline.createInterface({ input: process.stdin })) {
    let [xStr, yStr] = line.split(" ");
    let x = parseInt(xStr);
    let y = parseInt(yStr);
    r.step(x, y);
    r.printBoard();
    let [bx, by] = r.bestStep();
    r.step(bx, by);
    r.printBoard();
    console.log("current step is: ", (r.nextStep == Piece.BLACK ? "⚫" : "⚪"))
    console.log(r.feasibleSteps());
  }
}
// play();



class ReversiState {
  reversi: Reversi;
  lastUser: string;
  constructor() {
    this.reversi = new Reversi();
  }
}

const reversiInsts = new Map<string, ReversiState>();

function handleMessage(groupId: string, userId: string, rawMessage: string,callback: (string)=>void) {
  let rawtext = rawMessage.trim();
  if (!reversiInsts.has(groupId)) {
    reversiInsts.set(groupId, new ReversiState());
  }
  let state = reversiInsts.get(groupId);
  if(rawtext === "/begin" || rawtext === "/reset"){
    state.reversi = new Reversi();
    callback("\n"+state.reversi.printBoardToString());
    return;
  }
  if(rawtext === "/show"){
    callback("\n"+state.reversi.printBoardToString());
    return;
  }
  if(rawtext.split(/\s+/)[0]==="/step"){
    rawtext = rawtext.split(/\s+/).slice(1).join(" ");
  }
  let [x,y]= rawtext.split(/[\s,,、，]+/).map((t)=>parseInt(t)-1);
  let result = "\n";
  if(!state.reversi.isFinished()){
    result += `User ${state.reversi.nextStepToEmoji()} Chose to Step on ${x+1}, ${y+1}\n`;
    state.reversi.step(x, y);
    let [whitescore, blackscore] = state.reversi.score();
    result+=`Current Score: ⚫ ${blackscore}, ⚪ ${whitescore}\n`;
    const boardAfterUserStep = state.reversi.printBoardToString();
    result += boardAfterUserStep;
    if(!state.reversi.isFinished()){
      const [aiX, aiY]  = state.reversi.bestStep();
      result+=`Ai ${state.reversi.nextStepToEmoji()} Chose to Step on ${aiX+1}, ${aiY+1}\n`;
      state.reversi.step(aiX, aiY);
      let [whitescore, blackscore] = state.reversi.score();
      result+=`Current Score: ⚫ Score: ${blackscore}, ⚪  ${whitescore}\n`;
      const boardAfterAiStep = state.reversi.printBoardToString();
      result+=boardAfterAiStep;
    }
    if(state.reversi.isFinished()){
      let [whitescore, blackscore] = state.reversi.score();
      result+=`Game finished, Score: ⚫ ${blackscore}, ⚪ ${whitescore}\n`;
      result+="The game board is reset, please start a new game."
      state.reversi = new Reversi();
    }
    callback(result);
  }
}

function main() {
  const bot = new Bot(testConfig);
  bot.start().then(() => {
    console.log("system inited");
    bot.on('message.private', (e) => {
    });
    bot.on('message.group', (event) => {
      try{
        handleMessage(event.group_id, event.sender.user_id, event.raw_message, (result) => {
          event.reply(result);
        })
      }catch(error){
        event.reply(error.message);
      };
    })
  })
}
main();

process.on('uncaughtException', function (exception) {
  console.log(exception); // to see your exception details in the console
  // if you are on production, maybe you can send the exception details to your
  // email as well ?
});
