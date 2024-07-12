import bodyParser from "body-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import { initializeApp } from "firebase/app";
import {
    Database,
    equalTo,
    get,
    getDatabase,
    orderByChild,
    push,
    query,
    ref,
    remove,
    set,
    update
} from "firebase/database";
import moment from "moment-timezone";

export const app = express();

app.use(bodyParser.text());
app.use(bodyParser.json());

const firebaseConfig = {
  databaseURL: "https://database-cs2230-default-rtdb.firebaseio.com/",
};
const app2 = initializeApp(firebaseConfig);
const db: Database = getDatabase(app2);

app.use(cors());
const crypto = require("crypto");

app.put("/control/:name", async (req: Request, res: Response) => {
  const name = req.params.name;

  try {
    const machineRef = ref(db, "Machine");
    const snapshot = await get(
      query(machineRef, orderByChild("name"), equalTo(name))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Machine not found" });
    }

    const machinesData = snapshot.val();
    const machineId = Object.keys(machinesData)[0];

    const userMachineRef = ref(db, "User_Machine");
    const userMachineSnapshot = await get(
      query(userMachineRef, orderByChild("id_machine"), equalTo(machineId))
    );

    if (!userMachineSnapshot.exists()) {
      return res.status(404).json({ message: "User machine not found" });
    }

    const userMachineData = userMachineSnapshot.val();
    const userMachineId = Object.keys(userMachineData)[0];

    const controlRef = ref(db, "Control");
    const controlSnapshot = await get(
      query(controlRef, orderByChild("id_user_machine"), equalTo(userMachineId))
    );

    if (!controlSnapshot.exists()) {
      return res.status(404).json({ message: "Control data not found" });
    }

    const controlData = controlSnapshot.val();

    const date = moment().tz("Asia/Bangkok").format();
    const updates: { [key: string]: any } = {};
    Object.keys(controlData).forEach((key) => {
      updates[`/Control/${key}/date`] = date;
    });
    await update(ref(db), updates);

    res.status(200).json("updating control");
  } catch (error) {
    console.error("Error updating control data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post(
  "/machine/:name/:uuid",
  async (req, res) => {
    const name = req.params.name;
    const uuid = req.params.uuid;
    try {
      const machineRef = ref(db, "Machine");

      const snapshot = await get(
        query(machineRef, orderByChild("name"), equalTo(name))
      );
      if (snapshot.exists()) {
        return res.status(400).send("Name already exists");
      }
      const date = moment().tz("Asia/Bangkok").format();
      const newData = {
        name,
        uuid,
        date,
      };
      await push(machineRef, newData);
      res.status(200).send("User added successfully");
    } catch (error) {
      console.error("Error adding user:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.post(
  "/user/register/:name/:email/:address/:phone/:username/:password",
  async (req, res) => {
    const name = req.params.name;
    const email = req.params.email;
    const address = req.params.address;
    const phone = req.params.phone;
    const username = req.params.username;
    const password = req.params.password;
    try {
      const machineRef = ref(db, "User");

      const snapshot = await get(
        query(machineRef, orderByChild("username"), equalTo(username))
      );
      if (snapshot.exists()) {
        return res.status(400).send("Username already exists");
      }

      const hashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

      const newData = {
        name,
        email,
        address,
        phone,
        username,
        password: hashedPassword,
      };
      await push(machineRef, newData);
      res.status(201).send("User added successfully");
    } catch (error) {
      console.error("Error adding user:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get("/user/login/:username/:password", async (req, res) => {
  const username = req.params.username;
  const password = req.params.password;

  try {
    const userRef = ref(db, "User");
    const snapshot = await get(
      query(userRef, orderByChild("username"), equalTo(username))
    );
    const userData = snapshot.val();

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    let userId;
    let foundUser;

    Object.keys(userData).forEach((key) => {
      const user = userData[key];
      const hashedPassword = user.password;
      const inputHashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
      if (hashedPassword === inputHashedPassword) {
        userId = key;
        foundUser = user;
      }
    });

    if (!userId) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ userId });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/user_machine/:id_user/:uuid/:place", async (req, res) => {
  const id_user = req.params.id_user;
  const uuid = req.params.uuid;
  const place = req.params.place;

  try {
    const machineRef = ref(db, "Machine");
    const snapshot = await get(
      query(machineRef, orderByChild("uuid"), equalTo(uuid))
    );

    if (!snapshot.exists()) {
      return res
        .status(404)
        .json({ message: "Machine with the specified UUID not found" });
    }

    const machineData = snapshot.val();
    const machineId = Object.keys(machineData)[0];

    const userMachineRef = ref(db, "User_Machine");
    const userMachineSnapshot = await get(
      query(userMachineRef, orderByChild("id_machine"), equalTo(machineId))
    );
    const date = moment().tz("Asia/Bangkok").format();

    const controlRef = ref(db, "Control");

    if (!userMachineSnapshot.exists()) {
      const newUserData = {
        date,
        id_machine: machineId,
        id_user: id_user,
      };

      const newUserMachineRef = push(userMachineRef);
      await set(newUserMachineRef, newUserData);

      const newControlData = {
        place: place,
        status: 1,
        time: 1,
        id_user_machine: newUserMachineRef.key,
        date,
      };
      const newControlRef = push(controlRef);
      await set(newControlRef, newControlData);
      const id = newControlRef.key;

      res.status(200).json(id);
    } else {
      res.status(400).json("User no add successfully");
    }
  } catch (error) {
    console.error("Error searching for machine by UUID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/user_machine/:id", async (req: Request, res: Response) => {
  const id = req.params.id;

  try {
    const userMachineRef = ref(db, "User_Machine");
    const userMachineSnapshot = await get(
      query(userMachineRef, orderByChild("id_user"), equalTo(id))
    );

    if (!userMachineSnapshot.exists()) {
      return res.status(404).json({ message: "User machines not found" });
    }

    const machinesData = userMachineSnapshot.val();
    const machineIds = Object.keys(machinesData);

    const machines = [];

    for (const machineId of machineIds) {
      const controlRef = ref(db, "Control");
      const controlSnapshot = await get(
        query(controlRef, orderByChild("id_user_machine"), equalTo(machineId))
      );

      const dataRef = ref(db, "Data");
      const dataSnapshot = await get(
        query(dataRef, orderByChild("id_user_machine"), equalTo(machineId))
      );

      if (controlSnapshot.exists()) {

        const controlData = controlSnapshot.val();
        const controlIds = Object.keys(controlData);
        
        const now = moment().tz("Asia/Bangkok");
        const updates: { [key: string]: any } = {};

        const filteredControlss = controlIds
          .map((controlId) => {
            const control = controlData[controlId];
            const controlDate = moment(control.date).tz("Asia/Bangkok");
            const thresholdDate = controlDate.clone().add(5, 'minutes');

            if (now.isAfter(thresholdDate)) {
              updates[`/Control/${controlId}/status`] = 0;
              return { id: controlId, ...control };
            }

            return null;
          })
          .filter((control) => control !== null);
          for (const machineId of machineIds) {
            const controlRef = ref(db, "Control");
            const controlSnapshot = await get(
              query(controlRef, orderByChild("id_user_machine"), equalTo(machineId))
            );
          }
          const controlDatas = controlSnapshot.val();
          const controlIdess = Object.keys(controlDatas)[0];
          const controls = controlData[controlIdess];
          const controlWithId = { id: controlIdess, ...controls };

        const machineIdes = Object.keys(machinesData)[0];
        const machine = machinesData[machineIdes];
        const machineWithId = { id: machineIdes, ...machine };

        let dataWithId = null;
        if (dataSnapshot.exists()) {
          const dataData = dataSnapshot.val();
          const dataIds = Object.keys(dataData);
          const dataId = dataIds[dataIds.length - 1];
          const data = dataData[dataId];
          dataWithId = { id: dataId, ...data };
        }

        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }

        machines.push({
          user_machine: machineWithId,
          control: controlWithId,
          data: dataWithId,
        });
      }
    }

    res.status(200).json(machines);
  } catch (error) {
    console.error("Error searching for user machines:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/control/:id/:id_user_machine/:place/:status/:time", async (req, res) => {
  try {
    const id = req.params.id;
    const id_user_machine = req.params.id_user_machine;
    const place = req.params.place;
    const status = parseInt(req.params.status);
    const time = parseInt(req.params.time);

    const machineRef = ref(db, `Control/${id}`);
    const newData = {
      id_user_machine,
      place,
      status,
      time,
    };

    await set(machineRef, newData);
    res.status(200).send("Machine updated successfully");
  } catch (error) {
    console.error("Error updating machine:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/control/status/:id/:id_user_machine/:place/:status/:time", async (req, res) => {
  try {
    const id = req.params.id;
    const id_user_machine = req.params.id_user_machine;
    const place = req.params.place;
    const status = parseInt(req.params.status);
    const time = parseInt(req.params.time);
    
    let statuses;

    if(status == 0){
      statuses = 1;
    }else{
      statuses = 0;
    }

    const machineRef = ref(db, `Control/${id}`);
    const newData = {
      id_user_machine,
      place,
      status: statuses,
      time,
    };

    await set(machineRef, newData);
    res.status(200).send("Machine updated successfully");
  } catch (error) {
    console.error("Error updating machine:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.delete("/usermachine_control/:id/:ids", async (req, res) => {
  try {
    const id = req.params.id;
    const ids = req.params.ids;
    const controlRef = ref(db, `Control/${id}`);

    await remove(controlRef);

    const usermachineRef = ref(db, `User_Machine/${ids}`);

    await remove(usermachineRef);

    const dataRef = ref(db, "Data");

    const queryRef = query(dataRef, orderByChild("id_user_machine"), equalTo(ids));
    const dataSnapshot = await get(queryRef);
    dataSnapshot.forEach((childSnapshot) => {
      const key = childSnapshot.key;
      if (key) {
          remove(ref(db, `Data/${key}`));
      }
  });
  

    res.status(200).send("deleted successfully");
  } catch (error) {
    console.error("Error deleting machine:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/machines/:name", async (req: Request, res: Response) => {
  const name: string = req.params.name;

  try {
    const machineRef = ref(db, "Machine");
    const snapshot = await get(
      query(machineRef, orderByChild("name"), equalTo(name))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Machine not found" });
    }

    const machinesData: any = snapshot.val();
    const machineId: string = Object.keys(machinesData)[0];
    const machineWithId: any = { id: machineId };

    const userMachineRef = ref(db, "User_Machine");
    const userMachineSnapshot = await get(
      query(userMachineRef, orderByChild("id_machine"), equalTo(machineId))
    );

    if (userMachineSnapshot.exists()) {
      const userData: any = userMachineSnapshot.val();
      const userId: string = Object.keys(userData)[0];
      machineWithId.userId = userId;

      const controlRef = ref(db, "Control");
      const controlSnapshot = await get(
        query(controlRef, orderByChild("id_user_machine"), equalTo(userId))
      );

      if (controlSnapshot.exists()) {
        const controlData: any = controlSnapshot.val();
        const controlId: string = Object.keys(controlData)[0];
        const controlInfo: any = controlData[controlId];
        
        machineWithId.controlId = controlId;
        machineWithId.status = controlInfo.status;
        machineWithId.time = controlInfo.time;
      } else {
        machineWithId.controlId = null;
      }
    } else {
      machineWithId.userId = null;
    }

    res.status(200).json({ machineWithId });
  } catch (error) {
    console.error("Error searching for machine:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/data/:name/:pm2_5/:temperature/:humidity", async (req: Request, res: Response) => {
  const name: string = req.params.name;
  const pm2_5 = parseInt(req.params.pm2_5);
  const temperature = parseFloat(req.params.temperature);
  const humidity = parseFloat(req.params.humidity);

  try {
    const machineRef = ref(db, "Machine");
    const snapshot = await get(
      query(machineRef, orderByChild("name"), equalTo(name))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Machine not found" });
    }

    const machinesData: any = snapshot.val();
    const machineId: string = Object.keys(machinesData)[0];

    const userMachineRef = ref(db, "User_Machine");
    const userMachineSnapshot = await get(
      query(userMachineRef, orderByChild("id_machine"), equalTo(machineId))
    );

    if (!userMachineSnapshot.exists()) {
      return res.status(404).json({ message: "Machine not found" });
    }

    const usermachinesData: any = userMachineSnapshot.val();
    const id_user_machine: string = Object.keys(usermachinesData)[0];

    const machineRefs = ref(db, "Data");
    const date = moment().tz("Asia/Bangkok").format();
    const newData = {
      pm2_5,
      temperature,
      humidity,
      id_user_machine,
      date,
    };
    await push(machineRefs, newData);
    res.status(201).send("Machine added successfully");
  }
  catch (error) {
    console.error("Error searching for machine:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/data", async (req, res) => {
  const snapshot = await get(ref(db, "Data"));
  const data = snapshot.val();
  res.json(data);
});

app.get("/data/:id", async (req: Request, res: Response) => {
  const id_user_machine: string = req.params.id;

  try {
    const dataRef = ref(db, "Data");
    const snapshot = await get(
      query(dataRef, orderByChild("id_user_machine"), equalTo(id_user_machine))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No data found for the specified id_user_machine" });
    }

    const data = snapshot.val();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving data" });
  }
});

app.get("/data/day/:id", async (req: Request, res: Response) => {
  const id_user_machine: string = req.params.id;

  try {
    const dataRef = ref(db, "Data");
    const snapshot = await get(
      query(dataRef, orderByChild("id_user_machine"), equalTo(id_user_machine))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No data found for the specified id_user_machine" });
    }

    const data = snapshot.val();
    const currentDate = moment().tz("Asia/Bangkok").format("YYYY-MM-DD");

    const filteredData = Object.values(data).filter((entry: any) => {
      const entryDate = moment(entry.date).tz("Asia/Bangkok").format("YYYY-MM-DD");
      return entryDate === currentDate;
    });

    const pm2_5Values = filteredData.map((entry: any) => entry.pm2_5);
    const minPm2_5 = Math.min(...pm2_5Values);
    const maxPm2_5 = Math.max(...pm2_5Values);

    res.json({
      data: filteredData,
      minPm2_5,
      maxPm2_5,
    });
  } catch (error) {
    res.status(500).json({ error: "Error retrieving data" });
  }
});

app.get("/data/month/:id", async (req: Request, res: Response) => {
  const id_user_machine: string = req.params.id;

  try {
    const dataRef = ref(db, "Data");
    const snapshot = await get(
      query(dataRef, orderByChild("id_user_machine"), equalTo(id_user_machine))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No data found for the specified id_user_machine" });
    }

    const data = snapshot.val();
    const currentDate = moment().tz("Asia/Bangkok").format("YYYY-MM");

    const filteredData = Object.values(data).filter((entry: any) => {
      const entryDate = moment(entry.date).tz("Asia/Bangkok").format("YYYY-MM");
      return entryDate === currentDate;
    });

    const pm2_5Values = filteredData.map((entry: any) => entry.pm2_5);
    const minPm2_5 = Math.min(...pm2_5Values);
    const maxPm2_5 = Math.max(...pm2_5Values);

    res.json({
      data: filteredData,
      minPm2_5,
      maxPm2_5,
    });
  } catch (error) {
    res.status(500).json({ error: "Error retrieving data" });
  }
});

app.get("/data/year/:id", async (req: Request, res: Response) => {
  const id_user_machine: string = req.params.id;

  try {
    const dataRef = ref(db, "Data");
    const snapshot = await get(
      query(dataRef, orderByChild("id_user_machine"), equalTo(id_user_machine))
    );

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No data found for the specified id_user_machine" });
    }

    const data = snapshot.val();
    const currentDate = moment().tz("Asia/Bangkok").format("YYYY");

    const filteredData = Object.values(data).filter((entry: any) => {
      const entryDate = moment(entry.date).tz("Asia/Bangkok").format("YYYY");
      return entryDate === currentDate;
    });

    const pm2_5Values = filteredData.map((entry: any) => entry.pm2_5);
    const minPm2_5 = Math.min(...pm2_5Values);
    const maxPm2_5 = Math.max(...pm2_5Values);

    res.json({
      data: filteredData,
      minPm2_5,
      maxPm2_5,
    });
  } catch (error) {
    res.status(500).json({ error: "Error retrieving data" });
  }
});
//npx nodemon server.ts
