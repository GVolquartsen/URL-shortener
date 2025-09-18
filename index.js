import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import yeast from 'yeast';
import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// MySQL connection
const db = knex({
  client: 'mysql2',
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
  }
});

// Create table if it doesn't exist
(async () => {
  const exists = await db.schema.hasTable('urls');
  if (!exists) {
    await db.schema.createTable('urls', (table) => {
      table.increments('id').primary();
      table.text('url').notNullable();
      table.string('alias').unique();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('Table "urls" created');
  }
})();

// Home page
app.get('/', (req, res) => {
  const alias = req.query.alias || '';
  res.render('index', { alias });
});

// Create short URL
app.post('/', async (req, res) => {
  try {
    const url = (req.body.url || '').trim();

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).send('Invalid URL');
    }

    const [id] = await db('urls').insert({ url });
    const alias = yeast.encode(id);

    await db('urls').where({ id }).update({ alias });
    res.redirect('/?alias=' + encodeURIComponent(alias));
  } catch (err) {
    console.error('Error inserting URL:', err);
    res.status(500).send('Internal server error');
  }
});

// Redirect short URL
app.get('/:alias', async (req, res) => {
  try {
    const { alias } = req.params;
    const row = await db('urls').where({ alias }).first();
    if (!row) return res.status(404).send('Short URL not found');
    res.redirect(row.url);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('Server error');
  }
});

app.listen(3030, () => {
  console.log('Server running on http://localhost:3030');
});
