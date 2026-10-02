import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const PASSWORD = "Demo@2026";

async function login(page: Page, email = "admin@genietrvx.dz") {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/dashboard");
}

/** Échoue le test si la page lève une erreur JavaScript non interceptée. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) errors.push(msg.text());
  });
  return errors;
}

test.describe("authentification", () => {
  test("refuse un mot de passe invalide puis connecte l'administrateur", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Adresse e-mail").fill("admin@genietrvx.dz");
    await page.getByLabel("Mot de passe").fill("mauvais");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  });
});

test.describe("navigation complète", () => {
  const routes: Array<[string, RegExp]> = [
    ["/dashboard", /Bonjour/],
    ["/projects", /Chantiers/],
    ["/planning", /Planning/],
    ["/daily-reports", /Journal de chantier/],
    ["/markets", /Marchés/],
    ["/quotes", /Devis/],
    ["/invoices", /Factures/],
    ["/expenses", /Dépenses/],
    ["/estimation", /Estimation intelligente/],
    ["/employees", /Personnel/],
    ["/attendance", /Pointage/],
    ["/payroll", /Paie/],
    ["/materials", /Matériaux/],
    ["/stock", /Mouvements de stock/],
    ["/equipment", /Engins/],
    ["/clients", /Maîtres d'ouvrage/],
    ["/suppliers", /Fournisseurs/],
    ["/subcontractors", /Sous-traitants/],
    ["/subcontracts", /Contrats de sous-traitance/],
    ["/reports", /Rapports/],
    ["/users", /Utilisateurs/],
    ["/settings", /Paramètres/],
  ];

  test("toutes les pages s'affichent sans erreur", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    for (const [path, title] of routes) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(title);
      await expect(page.getByText("Une erreur est survenue")).toHaveCount(0);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("les pages de détail (chantier, marché, devis, facture) s'ouvrent", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    for (const list of ["/projects", "/markets", "/quotes", "/invoices"]) {
      await page.goto(list);
      await page.locator("tbody tr").first().click();
      await expect(page).toHaveURL(new RegExp(`${list}/[\\w-]+$`));
      await expect(page.getByText("Élément introuvable")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("parcours métier", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("crée, recherche et supprime un maître d'ouvrage", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.locator("#name").fill("Direction des Travaux Publics de Tlemcen");
    await page.locator("#phone").fill("043 20 30 40");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Élément créé.")).toBeVisible();
    await page.getByPlaceholder("Rechercher…").fill("Tlemcen");
    const row = page.locator("tbody tr", { hasText: "Direction des Travaux Publics de Tlemcen" });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Supprimer" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Élément supprimé.")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("affiche une erreur de validation sur un champ obligatoire", async ({ page }) => {
    await page.goto("/suppliers");
    await page.getByRole("button", { name: "Nouveau fournisseur" }).first().click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Veuillez corriger les champs signalés.")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Champ obligatoire")).toBeVisible();
  });

  test("importe un marché depuis un fichier Excel et complète le DQE par un CSV", async ({ page }) => {
    const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>DQE — Lycée 800 places</t></is></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>N°</t></is></c><c r="B3" t="inlineStr"><is><t>Désignation</t></is></c><c r="C3" t="inlineStr"><is><t>Unité</t></is></c><c r="D3" t="inlineStr"><is><t>Quantité</t></is></c><c r="E3" t="inlineStr"><is><t>Prix unitaire</t></is></c></row>
<row r="4"><c r="A4" t="inlineStr"><is><t>1.1</t></is></c><c r="B4" t="inlineStr"><is><t>Terrassements généraux</t></is></c><c r="C4" t="inlineStr"><is><t>m3</t></is></c><c r="D4"><v>1500</v></c><c r="E4"><v>700</v></c></row>
<row r="5"><c r="A5" t="inlineStr"><is><t>1.2</t></is></c><c r="B5" t="inlineStr"><is><t>Béton armé</t></is></c><c r="C5" t="inlineStr"><is><t>m3</t></is></c><c r="D5"><v>400</v></c><c r="E5"><v>28000</v></c></row>
<row r="6"><c r="B6" t="inlineStr"><is><t>Total</t></is></c><c r="E6"><v>12250000</v></c></row>
</sheetData></worksheet>`;
    const xlsx = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": strToU8(sheet) }));

    await page.goto("/markets");
    await page.getByRole("button", { name: "Importer (Excel / CSV)" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("dqe-file-input").setInputFiles({ name: "DQE lycee.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: xlsx });
    await expect(dialog.getByText(/2 article\(s\) détecté\(s\)/)).toBeVisible();
    await expect(dialog.locator("#object")).toHaveValue("DQE lycee");
    await dialog.locator("#object").fill("Réalisation d'un lycée 800 places");
    await dialog.getByRole("button", { name: "Créer le marché" }).click();
    await page.waitForURL(/\/markets\/[\w-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("lycée 800 places");
    await page.getByRole("tab", { name: /DQE/ }).click();
    await expect(page.locator("input[value='Béton armé']")).toBeVisible();

    await page.getByTestId("dqe-file-input").setInputFiles({
      name: "complement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Code;Désignation;Unité;Quantité;PU\n2.1;Étanchéité;m2;900;2 200,00\n"),
    });
    await expect(page.getByText("1 article(s) importé(s).")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
    await expect(page.locator("input[value='Étanchéité']")).toBeVisible();
  });

  test("ajoute une tâche au planning Gantt d'un chantier", async ({ page }) => {
    await page.goto("/projects");
    await page.locator("tbody tr", { hasText: "50 logements" }).click();
    await page.getByRole("tab", { name: /Planning Gantt/ }).click();
    await page.getByRole("button", { name: "Ajouter une tâche" }).click();
    await page.locator("#name").fill("Réception des réseaux VRD");
    await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("button", { name: /Réception des réseaux VRD/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "Calculer l'avancement depuis le planning" }).click();
    await expect(page.getByText(/Avancement mis à jour/)).toBeVisible();
  });

  test("établit une nouvelle situation de travaux et l'imprime", async ({ page, context }) => {
    await page.goto("/markets");
    await page.locator("tbody tr", { hasText: "50 logements" }).click();
    await page.getByRole("tab", { name: /Situations de travaux/ }).click();
    await page.getByRole("button", { name: "Nouvelle situation" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Situation n° 4")).toBeVisible();
    await dialog.getByTitle("Tout réaliser").first().click();
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(4);
    const [print] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "Situation" }).last().click()]);
    await expect(print.getByText("SITUATION DE TRAVAUX N° 4")).toBeVisible();
    await expect(print.getByText("Net à payer").first()).toBeVisible();
  });

  test("convertit un devis en facture puis enregistre un encaissement", async ({ page }) => {
    await page.goto("/quotes");
    await page.locator("tbody tr", { hasText: "DEV-" }).last().click();
    await page.getByRole("button", { name: "Convertir en facture" }).click();
    await page.waitForURL(/\/invoices\/[\w-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: /Facture FAC-\d{4}-\d{4}/ })).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer un encaissement" }).click();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
    await expect(page.getByText("Payée").first()).toBeVisible();
  });

  test("saisit le pointage du jour puis génère la paie", async ({ page }) => {
    await page.goto("/attendance");
    await page.getByRole("button", { name: "Tous présents" }).click();
    await page.getByRole("button", { name: "Enregistrer le pointage" }).click();
    await expect(page.getByText(/pointage\(s\) enregistré\(s\)/)).toBeVisible();
    await page.goto("/payroll");
    await page.getByRole("button", { name: "Générer la paie du mois" }).click();
    await expect(page.getByText(/bulletin\(s\) créé\(s\)/)).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("refuse une sortie de stock supérieure au stock disponible", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("button", { name: "Nouveau mouvement" }).first().click();
    await page.locator("#type").selectOption("out");
    await page.locator("#materialId").selectOption({ index: 1 });
    await page.locator("#quantity").fill("99999999");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("dialog").getByText(/Stock insuffisant/)).toBeVisible();
  });

  test("crée un devis à partir de l'estimation intelligente", async ({ page }) => {
    await page.goto("/estimation");
    await page.getByLabel("Surface bâtie totale (m²)").fill("320");
    await expect(page.getByText("Ventilation par lots")).toBeVisible();
    await page.getByRole("button", { name: "Créer un devis" }).click();
    await page.waitForURL(/\/quotes\/[\w-]+$/);
    await expect(page.locator("input[aria-label='Désignation']").first()).toHaveValue("Installation de chantier");
  });

  test("bascule l'interface en arabe (RTL) et revient au français", async ({ page }) => {
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("link", { name: "لوحة القيادة" })).toBeVisible();
    await page.getByRole("button", { name: "Français" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});

test.describe("documents PDF", () => {
  test("tous les documents imprimables s'affichent", async ({ page, request }) => {
    const errors = trackErrors(page);
    await login(page);
    const api = async (c: string) => {
      const res = await page.request.get(`/api/data/${c}`);
      return ((await res.json()) as { items: Array<{ id: string; period?: string }> }).items;
    };
    void request;
    const [quote] = await api("quotes");
    const [invoice] = await api("invoices");
    const [situation] = await api("situations");
    const [ods] = await api("ods");
    const [payslip] = await api("payslips");
    const [project] = await api("projects");
    const [report] = await api("dailyReports");
    const [movement] = await api("stockMovements");
    const [client] = await api("clients");
    const month = payslip.period!;
    const docs: Array<[string, RegExp]> = [
      [`/print/quote/${quote.id}`, /DEVIS/],
      [`/print/invoice/${invoice.id}`, /FACTURE/],
      [`/print/situation/${situation.id}`, /SITUATION DE TRAVAUX/],
      [`/print/attachment/${situation.id}`, /ATTACHEMENT/],
      [`/print/ods/${ods.id}`, /ORDRE DE SERVICE/],
      [`/print/payslip/${payslip.id}`, /BULLETIN DE PAIE/],
      [`/print/payroll/${month}`, /Livre de paie/],
      [`/print/attendance/${month}`, /Fiche de pointage mensuelle/],
      [`/print/project/${project.id}`, /Rapport de chantier/],
      [`/print/employees/all`, /Liste du personnel/],
      [`/print/stock/all`, /État du stock/],
      [`/print/equipment/all`, /Liste du parc/],
      [`/print/expenses/all`, /État des dépenses/],
      [`/print/daily-report/${report.id}`, /Journal de chantier/],
      [`/print/movement/${movement.id}`, /BON D/],
      [`/print/markets/all`, /Récapitulatif des marchés/],
      [`/print/invoices/all`, /Journal des ventes/],
      [`/print/client/${client.id}`, /Relevé client/],
    ];
    for (const [url, title] of docs) {
      await page.goto(url);
      await expect(page.locator("article.print-page")).toBeVisible();
      await expect(page.locator("article.print-page header")).toContainText(title);
      await expect(page.getByText("Élément introuvable")).toHaveCount(0);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("rôles et affichage mobile", () => {
  test("le chef de chantier ne voit pas la facturation", async ({ page }) => {
    await login(page, "chef@genietrvx.dz");
    await expect(page.getByRole("link", { name: "Pointage" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Factures" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Utilisateurs" })).toHaveCount(0);
    await page.goto("/invoices");
    await expect(page.getByText("Vous n'avez pas accès à cette section.")).toBeVisible();
  });

  test("le menu latéral s'ouvre sur mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Chantiers" }).first().click();
    await expect(page).toHaveURL(/\/projects$/);
    for (const path of ["/dashboard", "/projects", "/markets", "/invoices", "/payroll", "/attendance", "/estimation", "/materials"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `débordement horizontal sur ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
