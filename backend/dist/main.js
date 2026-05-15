"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
dotenv.config();
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    console.log('MONGO_URI:', process.env.MONGO_URI ? 'définie' : 'MANQUANTE');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.use('/api/health', (_req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send('ok');
    });
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Family Store POS backend running on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map