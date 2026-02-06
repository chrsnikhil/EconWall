import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'registrations.json');

// Interface for a registration
export interface Registration {
    subdomain: string;
    ensName: string;
    actualUrl: string;
    owner?: string;
    createdAt: string;
}

// In-memory cache to avoid reading disk on every request
let cache: Record<string, Registration> | null = null;

// Ensure data directory exists
function ensureDir() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Load registrations from disk
function loadRegistrations(): Record<string, Registration> {
    if (cache) return cache;

    ensureDir();
    if (!fs.existsSync(DB_PATH)) {
        // Seed with default demo
        const seed: Record<string, Registration> = {
            "demo.econwall.eth": {
                subdomain: "demo",
                ensName: "demo.econwall.eth",
                actualUrl: "http://localhost:3001",
                createdAt: new Date().toISOString()
            }
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
        cache = seed;
        return seed;
    }

    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        cache = JSON.parse(data);
        return cache || {};
    } catch (e) {
        console.error("Failed to load registrations DB:", e);
        return {};
    }
}

// Get all registrations (ensName -> Registration)
export function getRegistrations(): Record<string, Registration> {
    return loadRegistrations();
}

// Get a single registration URL by ENS name
export function getRegistrationUrl(ensName: string): string | null {
    const db = loadRegistrations();
    const entry = db[ensName.toLowerCase()];
    return entry ? entry.actualUrl : null;
}

// Save a new registration
export function saveRegistration(subdomain: string, actualUrl: string, owner?: string): Registration {
    const db = loadRegistrations();
    const ensName = `${subdomain.toLowerCase()}.econwall.eth`;

    const newEntry: Registration = {
        subdomain: subdomain.toLowerCase(),
        ensName,
        actualUrl,
        owner,
        createdAt: new Date().toISOString()
    };

    db[ensName] = newEntry;
    cache = db;

    ensureDir();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

    return newEntry;
}
