import { game } from './engine.js';
import { loadBuildings } from './buildings.js';
import assets from './assets.json';
import { prepareNightArt } from './night-art.js';
import { makeArt } from './art.js';
import { prepareInterface } from './interface.js';
import { addDebugControls } from './debug.js';
import { Title } from './scenes/Title.js';
import { Play } from './scenes/Play.js';
import { Pause } from './scenes/Pause.js';
await game.assets.load([
    { kind: 'font', key: 'chinese', family: 'Speedster Chinese', url: 'assets/chinese.woff2' },
]);
makeArt();
prepareNightArt();
prepareInterface();
await Promise.all([loadBuildings(), game.assets.load(assets, { pack: 'title' }), game.modelFiles.load('kestrel', 'assets/kestrel.glb')]);
game.scenes.register(Title);
game.scenes.register(Play);
game.scenes.register(Pause);
addDebugControls();
await game.start();
game.scenes.go('title');
