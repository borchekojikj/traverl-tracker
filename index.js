import express from "express";

import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

const app = express();
const port = 3000;

dotenv.config({ path: "./config.env" });

const db = new pg.Client({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId;

const renderPageForCurrentUser = async function (req, res, id = null) {
  const users = await getUsers();
  const countries = id ? await checkVisisted(id) : [];
  let color1 = "";
  if (id) {
    let color = await db.query("SELECT color FROM users WHERE id = $1", [id]);
    color1 = color.rows[0].color;
  }

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: color1,
  });
};

const getUsers = async function () {
  let usersData = await db.query("SELECT * FROM users");
  let users = usersData.rows;
  return users;
};

async function checkVisisted(id) {
  currentUserId = id;
  const result = await db.query(
    "SELECT country_code FROM visited_countries1 WHERE user_id=$1",
    [id]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  console.log(countries);
  return countries;
}

app.get("/", async (req, res) => {
  renderPageForCurrentUser(req, res);
});
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  if (input === "") return res.redirect("/");
  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );
    console.log(currentUserId);
    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries1 (country_code,user_id) VALUES ($1,$2)",
        [countryCode, currentUserId]
      );
      renderPageForCurrentUser(req, res, currentUserId);
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});
app.post("/user", async (req, res) => {
  const userId = req.body.user ?? null;

  if (userId) {
    renderPageForCurrentUser(req, res, userId);
  } else {
    res.render("new.ejs");
  }
});

app.post("/new", async (req, res) => {
  const users = getUsers();

  try {
    const userId = db.query(
      "INSERT INTO users (name,color) VALUES ($1,$2) RETURNING id",
      [req.body.name, req.body.color]
    );
    if (userId) {
      console.log("User has been added!");
      res.redirect("/");
    }
  } catch (error) {
    renderPageForCurrentUser(req, res, userId);
  }
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
