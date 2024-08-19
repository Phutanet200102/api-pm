import bodyParser from "body-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import { initializeApp } from "firebase/app";
import {
  child,
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

        const filteredControls = controlIds
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

        const controlIdess = controlIds.length > 0 ? controlIds[0] : null;
        const controlWithId = controlIdess ? { id: controlIdess, ...controlData[controlIdess] } : null;

        const machineIdes = Object.keys(machinesData)[0];
        const machine = machinesData[machineIdes];
        const machineWithId = { id: machineIdes, ...machine };

        let dataWithId = null;
        if (dataSnapshot.exists()) {
          const dataData = dataSnapshot.val();
          const dataIds = Object.keys(dataData);

          const latestDataId = dataIds.reduce((latestId, currentId) => {
            return moment(dataData[currentId].date).isAfter(moment(dataData[latestId].date)) ? currentId : latestId;
          }, dataIds[0]);

          dataWithId = { id: latestDataId, ...dataData[latestDataId] };
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

app.put("/control/:id/:id_user_machine/:place/:status/:time/:date", async (req, res) => {
  try {
    const id = req.params.id;
    const id_user_machine = req.params.id_user_machine;
    const place = req.params.place;
    const status = parseInt(req.params.status);
    const time = parseInt(req.params.time);
    const date  = req.params.date;

    const machineRef = ref(db, `Control/${id}`);
    const newData = {
      date,
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

app.post("/control/status/:id/:id_user_machine/:place/:status/:time", async (req, res) => {
  try {
    const id = req.params.id;
    const id_user_machine = req.params.id_user_machine;
    const place = req.params.place;
    const status = req.params.status;
    const time = req.params.time;
    const date = moment().tz("Asia/Bangkok").format();
    let statuses;


    if(status == '0'){
      statuses = 1;
    }else{
      statuses = 0;
    }

    const machineRef = ref(db, `Control/${id}`);
    const newData = {
      id_user_machine,
      place,
      status: statuses,
      time: parseInt(time),
      date,
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

    const filteredData = Object.entries(data).filter(([key, entry]: [string, any]) => {
      const entryDate = moment(entry.date).tz("Asia/Bangkok").format("YYYY-MM-DD");
      return entryDate === currentDate;
    });

    const latestKey = Object.keys(data).reduce((a, b) => (data[a].date > data[b].date ? a : b));

    const filteredDataWithoutLatest = filteredData.filter(([key]) => key !== latestKey);

    const groupedData: { [hour: string]: { keys: string[], temperature: number[], humidity: number[], pm2_5: number[], id_user_machine: string, date: string } } = {};

    filteredDataWithoutLatest.forEach(([key, entry]: [string, any]) => {
      const hour = moment(entry.date).tz("Asia/Bangkok").format("HH");
      if (!groupedData[hour]) {
        groupedData[hour] = { keys: [], temperature: [], humidity: [], pm2_5: [], id_user_machine: entry.id_user_machine, date: entry.date };
      }
      groupedData[hour].keys.push(key);
      groupedData[hour].temperature.push(entry.temperature);
      groupedData[hour].humidity.push(entry.humidity);
      groupedData[hour].pm2_5.push(entry.pm2_5);
    });

    const hourlyData = Object.entries(groupedData).map(([hour, values]) => {
      const avgTemperature = (values.temperature.reduce((a, b) => a + b, 0) / values.temperature.length).toFixed(1);
      const avgHumidity = (values.humidity.reduce((a, b) => a + b, 0) / values.humidity.length).toFixed(1);
      const avgPm2_5 = (values.pm2_5.reduce((a, b) => a + b, 0) / values.pm2_5.length).toFixed(1);

      return {
        hour: parseInt(hour),
        id_user_machine: values.id_user_machine,
        date: values.date,
        temperature: parseFloat(avgTemperature),
        humidity: parseFloat(avgHumidity),
        pm2_5: parseFloat(avgPm2_5),
      };
    });

    hourlyData.sort((a, b) => a.hour - b.hour);

    for (const values of Object.values(groupedData)) {
      for (const key of values.keys) {
        if (key !== latestKey) {
          await remove(ref(db, `Data/${key}`));
        }
      }
    }

    for (const hourData of hourlyData) {
      const newKey = push(ref(db, "Data")).key;
      await set(ref(db, `Data/${newKey}`), {
        id_user_machine: hourData.id_user_machine,
        date: hourData.date,
        temperature: hourData.temperature,
        humidity: hourData.humidity,
        pm2_5: hourData.pm2_5,
      });
    }

    const averageTemperatures = hourlyData.map(entry => entry.temperature);
    const averageHumidities = hourlyData.map(entry => entry.humidity);
    const averagePm2_5Values = hourlyData.map(entry => entry.pm2_5);

    const minTemperature = Math.min(...averageTemperatures).toFixed(1);
    const maxTemperature = Math.max(...averageTemperatures).toFixed(1);
    const minHumidity = Math.min(...averageHumidities).toFixed(1);
    const maxHumidity = Math.max(...averageHumidities).toFixed(1);
    const minPm2_5 = Math.min(...averagePm2_5Values).toFixed(1);
    const maxPm2_5 = Math.max(...averagePm2_5Values).toFixed(1);

    res.json({
      data: hourlyData,
      minTemperature: parseFloat(minTemperature),
      maxTemperature: parseFloat(maxTemperature),
      minHumidity: parseFloat(minHumidity),
      maxHumidity: parseFloat(maxHumidity),
      minPm2_5: parseFloat(minPm2_5),
      maxPm2_5: parseFloat(maxPm2_5),
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
    const today = moment().tz("Asia/Bangkok").format("YYYY-MM-DD");

    const filteredData = Object.entries(data).filter(([key, entry]: [string, any]) => {
      const entryDate = moment(entry.date).tz("Asia/Bangkok").format("YYYY-MM");
      return entryDate === currentDate && moment(entry.date).tz("Asia/Bangkok").format("YYYY-MM-DD") !== today;
    });

    const latestKey = Object.keys(data).reduce((latest, key) => {
      return moment(data[key].date).isAfter(moment(data[latest].date)) ? key : latest;
    }, Object.keys(data)[0]);

    const filteredDataWithoutLatest = filteredData.filter(([key]) => key !== latestKey);

    const groupedData: { [day: string]: { [hour: string]: { keys: string[], temperature: number[], humidity: number[], pm2_5: number[], id_user_machine: string, date: string } } } = {};

    filteredDataWithoutLatest.forEach(([key, entry]: [string, any]) => {
      const day = moment(entry.date).tz("Asia/Bangkok").format("YYYY-MM-DD");
      const hour = moment(entry.date).tz("Asia/Bangkok").format("HH");
      
      if (!groupedData[day]) {
        groupedData[day] = {};
      }
      
      if (!groupedData[day][hour]) {
        groupedData[day][hour] = { keys: [], temperature: [], humidity: [], pm2_5: [], id_user_machine: entry.id_user_machine, date: entry.date };
      }
      
      groupedData[day][hour].keys.push(key);
      groupedData[day][hour].temperature.push(entry.temperature);
      groupedData[day][hour].humidity.push(entry.humidity);
      groupedData[day][hour].pm2_5.push(entry.pm2_5);
    });

    const sortedGroupedData = Object.entries(groupedData).sort(([day1], [day2]) => {
      return moment(day1).isBefore(moment(day2)) ? -1 : 1;
    });

    const dailyData = sortedGroupedData.map(([day, hoursData]) => {
      const hourlyData = Object.entries(hoursData).map(([hour, values]) => {
        const avgTemperature = (values.temperature.reduce((a, b) => a + b, 0) / values.temperature.length).toFixed(1);
        const avgHumidity = (values.humidity.reduce((a, b) => a + b, 0) / values.humidity.length).toFixed(1);
        const avgPm2_5 = (values.pm2_5.reduce((a, b) => a + b, 0) / values.pm2_5.length).toFixed(1);

        return {
          hour: parseInt(hour),
          id_user_machine: values.id_user_machine,
          date: values.date,
          keys: values.keys,
          temperature: parseFloat(avgTemperature),
          humidity: parseFloat(avgHumidity),
          pm2_5: parseFloat(avgPm2_5),
        };
      });

      const dailyTemperature = (hourlyData.reduce((sum, entry) => sum + entry.temperature, 0) / hourlyData.length).toFixed(1);
      const dailyHumidity = (hourlyData.reduce((sum, entry) => sum + entry.humidity, 0) / hourlyData.length).toFixed(1);
      const dailyPm2_5 = (hourlyData.reduce((sum, entry) => sum + entry.pm2_5, 0) / hourlyData.length).toFixed(1);
      const firstEntry = hourlyData[0];

      const dailyKeys = hourlyData.flatMap(entry => entry.keys);

      return {
        day,
        hourlyData,
        dailyAverage: {
          id_user_machine: firstEntry.id_user_machine,
          date: firstEntry.date,
          temperature: parseFloat(dailyTemperature),
          humidity: parseFloat(dailyHumidity),
          pm2_5: parseFloat(dailyPm2_5),
          keys: dailyKeys, 
        }
      };
    });

    const allDailyTemperatures = dailyData.map(dayData => dayData.dailyAverage.temperature);
    const allDailyHumidities = dailyData.map(dayData => dayData.dailyAverage.humidity);
    const allDailyPm2_5Values = dailyData.map(dayData => dayData.dailyAverage.pm2_5);

    const minTemperature = Math.min(...allDailyTemperatures).toFixed(1);
    const maxTemperature = Math.max(...allDailyTemperatures).toFixed(1);
    const minHumidity = Math.min(...allDailyHumidities).toFixed(1);
    const maxHumidity = Math.max(...allDailyHumidities).toFixed(1);
    const minPm2_5 = Math.min(...allDailyPm2_5Values).toFixed(1);
    const maxPm2_5 = Math.max(...allDailyPm2_5Values).toFixed(1);

    const updates: { [key: string]: null | any } = {};

    dailyData.forEach(dayData => {
      dayData.dailyAverage.keys.forEach(key => {
        if (key !== latestKey) {
          updates[`Data/${key}`] = null;
        }
      });

      const newEntryKey = push(child(ref(db), "Data")).key;
      if (newEntryKey) {
        updates[`Data/${newEntryKey}`] = {
          id_user_machine: dayData.dailyAverage.id_user_machine,
          date: dayData.dailyAverage.date,
          temperature: dayData.dailyAverage.temperature,
          humidity: dayData.dailyAverage.humidity,
          pm2_5: dayData.dailyAverage.pm2_5,
        };
      }
    });

    await update(ref(db), updates);

    res.json({
      data: dailyData.map(dayData => ({
        id_user_machine: dayData.dailyAverage.id_user_machine,
        date: dayData.dailyAverage.date,
        temperature: dayData.dailyAverage.temperature,
        humidity: dayData.dailyAverage.humidity,
        pm2_5: dayData.dailyAverage.pm2_5,
      })),
      minTemperature: parseFloat(minTemperature),
      maxTemperature: parseFloat(maxTemperature),
      minHumidity: parseFloat(minHumidity),
      maxHumidity: parseFloat(maxHumidity),
      minPm2_5: parseFloat(minPm2_5),
      maxPm2_5: parseFloat(maxPm2_5),
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
      const currentYear = moment().tz("Asia/Bangkok").format("YYYY");
      const currentMonth = moment().tz("Asia/Bangkok").format("MM");

      const filteredData = Object.entries(data).filter(([key, entry]: [string, any]) => {
          const entryYear = moment(entry.date).tz("Asia/Bangkok").format("YYYY");
          const entryMonth = moment(entry.date).tz("Asia/Bangkok").format("MM");
          return entryYear === currentYear && entryMonth !== currentMonth;
      });

      const monthlyData: { [key: string]: any[] } = {};

      filteredData.forEach(([key, entry]: [string, any]) => {
          const month = moment(entry.date).tz("Asia/Bangkok").format("MM");
          if (!monthlyData[month]) {
              monthlyData[month] = [];
          }
          monthlyData[month].push({ key, ...entry });
      });

      const result = Object.keys(monthlyData).map((month) => {
          const entries = monthlyData[month];

          const pm2_5Values = entries.map((entry: any) => entry.pm2_5);
          const humidityValues = entries.map((entry: any) => entry.humidity);
          const temperatureValues = entries.map((entry: any) => entry.temperature);

          const avgPm2_5 = (pm2_5Values.reduce((sum, value) => sum + value, 0) / pm2_5Values.length) || 0;
          const avgHumidity = (humidityValues.reduce((sum, value) => sum + value, 0) / humidityValues.length) || 0;
          const avgTemperature = (temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length) || 0;

          return {
              month,
              id_user_machine: entries[0].id_user_machine,
              date: entries[0].date,
              keys: entries.map((entry: any) => entry.key),
              pm2_5: parseFloat(avgPm2_5.toFixed(1)),
              humidity: parseFloat(avgHumidity.toFixed(1)),
              temperature: parseFloat(avgTemperature.toFixed(1)),
          };
      });

      const allTemperatures = result.map(entry => entry.temperature);
      const allHumidities = result.map(entry => entry.humidity);
      const allPm2_5Values = result.map(entry => entry.pm2_5);

      const minTemperature = Math.min(...allTemperatures).toFixed(1);
      const maxTemperature = Math.max(...allTemperatures).toFixed(1);
      const minHumidity = Math.min(...allHumidities).toFixed(1);
      const maxHumidity = Math.max(...allHumidities).toFixed(1);
      const minPm2_5 = Math.min(...allPm2_5Values).toFixed(1);
      const maxPm2_5 = Math.max(...allPm2_5Values).toFixed(1);

      for (const monthData of result) {
          for (const key of monthData.keys) {
              await remove(ref(db, `Data/${key}`));
          }
      }

      for (const monthData of result) {
          const newData = {
              id_user_machine: monthData.id_user_machine,
              date: monthData.date,
              temperature: monthData.temperature,
              humidity: monthData.humidity,
              pm2_5: monthData.pm2_5,
          };

          const newKey = push(ref(db, "Data")).key;
          await set(ref(db, `Data/${newKey}`), newData);
      }

      res.json({
          data: result,
          minTemperature: parseFloat(minTemperature),
          maxTemperature: parseFloat(maxTemperature),
          minHumidity: parseFloat(minHumidity),
          maxHumidity: parseFloat(maxHumidity),
          minPm2_5: parseFloat(minPm2_5),
          maxPm2_5: parseFloat(maxPm2_5),
      });
  } catch (error) {
      res.status(500).json({ error: "Error retrieving data" });
  }
});

//npx nodemon server.ts

//git init
//git add .
//git status
//git commit -m "added channel name"
//git branch
//git push origin main