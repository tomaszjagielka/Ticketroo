const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Importujemy modele
const User = require("./models/User");
const Role = require("./models/Role");
const Permission = require("./models/Permission");
const TicketType = require("./models/TicketType");
const Sla = require("./models/Sla");

// Połączenie z bazą danych
mongoose.connect("mongodb://localhost:27017/ticket-system", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Podstawowe uprawnienia
const basicPermissions = [
  "CREATE_TICKET",
  "VIEW_TICKET",
  "UPDATE_TICKET",
  "MANAGE_PROJECTS",
  "MANAGE_USERS",
  "GENERATE_REPORTS",
  "MANAGE_SUGGESTIONS",
  "VIEW_ANALYTICS",
  "MANAGE_SYSTEM",
  "MANAGE_PROJECT_AS_MANAGER",
];

// Role i ich uprawnienia
const roles = [
  {
    name: "Klient",
    permissions: ["CREATE_TICKET", "VIEW_TICKET"],
  },
  {
    name: "Specjalista",
    permissions: [
      "CREATE_TICKET",
      "VIEW_TICKET",
      "UPDATE_TICKET",
      "MANAGE_PROJECT_AS_MANAGER",
    ],
  },
  {
    name: "Zarządca",
    permissions: [
      "CREATE_TICKET",
      "VIEW_TICKET",
      "UPDATE_TICKET",
      "MANAGE_PROJECTS",
      "MANAGE_USERS",
      "MANAGE_SYSTEM",
    ],
  },
  {
    name: "Analityk",
    permissions: ["VIEW_TICKET", "GENERATE_REPORTS", "VIEW_ANALYTICS"],
  },
  {
    name: "Developer",
    permissions: ["VIEW_TICKET", "MANAGE_SUGGESTIONS", "MANAGE_SYSTEM"],
  },
];

// Użytkownicy do utworzenia
const users = [
  {
    login: "klient",
    password: "klient123",
    roleName: "Klient",
  },
  {
    login: "specjalista",
    password: "specjalista123",
    roleName: "Specjalista",
  },
  {
    login: "zarzadca",
    password: "zarzadca123",
    roleName: "Zarządca",
  },
  {
    login: "analityk",
    password: "analityk123",
    roleName: "Analityk",
  },
  {
    login: "developer",
    password: "developer123",
    roleName: "Developer",
  },
];

// Typy zgłoszeń
const ticketTypes = [
  {
    name: "Błąd",
    description: "Defekt w oprogramowaniu wymagający naprawy",
  },
  {
    name: "Nowa Funkcjonalność",
    description: "Prośba o dodanie nowej funkcjonalności",
  },
  {
    name: "Wsparcie",
    description: "Ogólne zapytanie o wsparcie",
  },
  {
    name: "Problem Bezpieczeństwa",
    description: "Problem związany z bezpieczeństwem",
  },
  {
    name: "Problem Wydajności",
    description: "Problem z wydajnością systemu",
  },
];

// Konfiguracje SLA
const slaConfigs = [
  // Błędy
  {
    ticketTypeName: "Błąd",
    priority: "niski",
    responseTime: 240, // 4h
    resolutionTime: 2880, // 48h
  },
  {
    ticketTypeName: "Błąd",
    priority: "średni",
    responseTime: 120, // 2h
    resolutionTime: 1440, // 24h
  },
  {
    ticketTypeName: "Błąd",
    priority: "wysoki",
    responseTime: 60, // 1h
    resolutionTime: 480, // 8h
  },
  // Problemy Bezpieczeństwa
  {
    ticketTypeName: "Problem Bezpieczeństwa",
    priority: "niski",
    responseTime: 120, // 2h
    resolutionTime: 1440, // 24h
  },
  {
    ticketTypeName: "Problem Bezpieczeństwa",
    priority: "średni",
    responseTime: 60, // 1h
    resolutionTime: 480, // 8h
  },
  {
    ticketTypeName: "Problem Bezpieczeństwa",
    priority: "wysoki",
    responseTime: 30, // 30min
    resolutionTime: 240, // 4h
  },
  // Wsparcie
  {
    ticketTypeName: "Wsparcie",
    priority: "niski",
    responseTime: 480, // 8h
    resolutionTime: 4320, // 72h
  },
  {
    ticketTypeName: "Wsparcie",
    priority: "średni",
    responseTime: 240, // 4h
    resolutionTime: 2880, // 48h
  },
  {
    ticketTypeName: "Wsparcie",
    priority: "wysoki",
    responseTime: 120, // 2h
    resolutionTime: 1440, // 24h
  },
  // Nowe Funkcjonalności
  {
    ticketTypeName: "Nowa Funkcjonalność",
    priority: "niski",
    responseTime: 720, // 12h
    resolutionTime: 10080, // 7 dni
  },
  {
    ticketTypeName: "Nowa Funkcjonalność",
    priority: "średni",
    responseTime: 480, // 8h
    resolutionTime: 7200, // 5 dni
  },
  {
    ticketTypeName: "Nowa Funkcjonalność",
    priority: "wysoki",
    responseTime: 240, // 4h
    resolutionTime: 4320, // 3 dni
  },
  // Problemy Wydajności
  {
    ticketTypeName: "Problem Wydajności",
    priority: "niski",
    responseTime: 240, // 4h
    resolutionTime: 2880, // 48h
  },
  {
    ticketTypeName: "Problem Wydajności",
    priority: "średni",
    responseTime: 120, // 2h
    resolutionTime: 1440, // 24h
  },
  {
    ticketTypeName: "Problem Wydajności",
    priority: "wysoki",
    responseTime: 60, // 1h
    resolutionTime: 720, // 12h
  },
];

// Funkcja inicjalizująca uprawnienia
const seedPermissions = async () => {
  try {
    const permissionDocs = await Promise.all(
      basicPermissions.map(async (permName) => {
        // Sprawdź czy uprawnienie już istnieje
        const existingPermission = await Permission.findOne({ name: permName });
        if (existingPermission) {
          console.log(`Uprawnienie ${permName} już istnieje`);
          return existingPermission;
        }

        const permission = new Permission({
          name: permName,
          description: `Uprawnienie do ${permName
            .toLowerCase()
            .replace(/_/g, " ")}`,
        });
        return permission.save();
      })
    );
    console.log("Uprawnienia zostały zainicjalizowane");
    return permissionDocs;
  } catch (error) {
    console.error("Błąd podczas tworzenia uprawnień:", error);
    throw error;
  }
};

// Funkcja inicjalizująca typy zgłoszeń
const seedTicketTypes = async () => {
  try {
    const ticketTypeDocs = await Promise.all(
      ticketTypes.map(async (type) => {
        const existingType = await TicketType.findOne({ name: type.name });
        if (existingType) return existingType;

        const newType = new TicketType(type);
        return newType.save();
      })
    );
    console.log("Typy zgłoszeń zostały zainicjalizowane");
    return ticketTypeDocs;
  } catch (error) {
    console.error("Błąd podczas tworzenia typów zgłoszeń:", error);
    throw error;
  }
};

// Funkcja inicjalizująca SLA
const seedSLA = async (ticketTypeDocs) => {
  try {
    await Promise.all(
      slaConfigs.map(async (config) => {
        const ticketType = ticketTypeDocs.find(
          (type) => type.name === config.ticketTypeName
        );
        if (!ticketType) return;

        const existingSLA = await Sla.findOne({
          ticketType: ticketType._id,
          priority: config.priority,
        });
        if (existingSLA) return existingSLA;

        const newSLA = new Sla({
          ticketType: ticketType._id,
          priority: config.priority,
          responseTime: config.responseTime,
          resolutionTime: config.resolutionTime,
        });
        return newSLA.save();
      })
    );
    console.log("Konfiguracje SLA zostały zainicjalizowane");
  } catch (error) {
    console.error("Błąd podczas tworzenia konfiguracji SLA:", error);
    throw error;
  }
};

// Główna funkcja inicjalizująca bazę danych
const seedDatabase = async () => {
  try {
    // Tworzenie uprawnień
    const permissionDocs = await seedPermissions();

    // Tworzenie ról
    const roleDocs = await Promise.all(
      roles.map(async (role) => {
        const existingRole = await Role.findOne({ name: role.name });
        if (existingRole) return existingRole;

        const rolePermissions = permissionDocs.filter((p) =>
          role.permissions.includes(p.name)
        );
        const newRole = new Role({
          name: role.name,
          permissions: rolePermissions.map((p) => p._id),
        });
        return newRole.save();
      })
    );

    // Tworzenie użytkowników
    await Promise.all(
      users.map(async (user) => {
        const existingUser = await User.findOne({ login: user.login });
        if (existingUser) {
          console.log(`Użytkownik ${user.login} już istnieje`);
          return;
        }

        const role = roleDocs.find((r) => r.name === user.roleName);
        const hashedPassword = await bcrypt.hash(user.password, 10);

        const newUser = new User({
          login: user.login,
          password: hashedPassword,
          role: role._id,
        });

        await newUser.save();
        console.log(`Utworzono użytkownika: ${user.login}`);
      })
    );

    // Tworzenie typów zgłoszeń
    const ticketTypeDocs = await seedTicketTypes();

    // Tworzenie konfiguracji SLA
    await seedSLA(ticketTypeDocs);

    console.log("Baza danych została zainicjalizowana");
    process.exit(0);
  } catch (error) {
    console.error("Błąd podczas inicjalizacji bazy danych:", error);
    process.exit(1);
  }
};

// Uruchomienie skryptu
seedDatabase();
