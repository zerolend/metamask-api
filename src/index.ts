import express from "express";
import bodyParser from "body-parser";
import * as http from "http";
import nconf from "nconf";
import cors from "cors";
import cron from "node-cron";

import { apy as zerolendApy } from "./protocols/zerolend";
// import { apy as aave_v2Apy } from "./protocols/aave-v2";
import { apy as aave_v3Apy } from "./protocols/aave-v3";
import routes from "./routes";

const app = express();
const server = new http.Server(app);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(routes);

cron.schedule("*/10 * * * *", async () => {
  console.log("fetch updated pools data every 10 mins");
  await zerolendApy();
  // await aave_v2Apy();
  await aave_v3Apy();
});

zerolendApy();
// aave_v2Apy();
aave_v3Apy();

app.set("port", nconf.get("PORT") || 5006);
const port = app.get("port");
server.listen(port, () => console.log(`Server started on port ${port}`));
