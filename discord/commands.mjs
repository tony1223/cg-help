import {PetCalcCommand} from "./commands/petcalc.mjs"
import {AskGptCommand} from "./commands/askgpt.mjs"
import {MapCommand} from "./commands/map.mjs"
import {MapRegCommand} from "./commands/mapreg.mjs"
import {MissionCommand} from "./commands/mission.mjs"
import {MissionRegCommand} from "./commands/missionreg.mjs"

const commands = [
    PetCalcCommand,
    MissionCommand,
    MissionRegCommand,
    AskGptCommand,
    MapCommand,
    MapRegCommand
]
export {commands};