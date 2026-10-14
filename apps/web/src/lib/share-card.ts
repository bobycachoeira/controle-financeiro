export interface ShareCardPerson {
  label: string;
  paidCents: number;
}

export interface ShareCardCategory {
  name: string;
  totalCents: number;
}

export interface ShareCardInput {
  monthLabel: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  people: ShareCardPerson[];
  topCategories: ShareCardCategory[];
  comparison: string;
}

const COLORS = {
  bgFrom: "#0B3B2E",
  bgTo: "#14532D",
  text: "#F6FBF7",
  muted: "#A7C4B5",
  green: "#5FD39B",
  red: "#F08A5D",
  bar: "rgba(95, 211, 155, 0.9)",
};

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function font(size: number, weight = 700): string {
  return `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, height / 2, width / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

/** Desenha o card do fechamento (1080x1350) e devolve o PNG. */
export function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("Canvas indisponível neste dispositivo."));
  }

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, COLORS.bgFrom);
  gradient.addColorStop(1, COLORS.bgTo);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.textAlign = "left";
  context.fillStyle = COLORS.muted;
  context.font = font(34, 800);
  context.fillText("FECHAMENTO DO MÊS", 72, 150);

  context.fillStyle = COLORS.text;
  context.font = font(80, 900);
  context.fillText(input.monthLabel, 72, 250);

  context.fillStyle = COLORS.muted;
  context.font = font(32, 700);
  context.fillText("Sobrou no mês", 72, 380);
  context.fillStyle = input.netCents >= 0 ? COLORS.green : COLORS.red;
  context.font = font(112, 900);
  context.fillText(brl(input.netCents), 72, 500);

  context.font = font(40, 800);
  context.fillStyle = COLORS.green;
  context.fillText(`+ ${brl(input.incomeCents)}`, 72, 600);
  context.fillStyle = COLORS.red;
  context.fillText(`− ${brl(input.expenseCents)}`, 480, 600);

  context.fillStyle = COLORS.muted;
  context.font = font(30, 600);
  context.fillText(input.comparison, 72, 665);

  let y = 790;
  context.fillStyle = COLORS.text;
  context.font = font(40, 800);
  context.fillText("Quem contribuiu", 72, y);
  y += 68;
  for (const person of input.people.slice(0, 4)) {
    context.fillStyle = COLORS.muted;
    context.font = font(36, 600);
    context.fillText(person.label, 72, y);
    context.fillStyle = COLORS.text;
    context.font = font(36, 800);
    context.textAlign = "right";
    context.fillText(brl(person.paidCents), width - 72, y);
    context.textAlign = "left";
    y += 60;
  }

  y += 40;
  context.fillStyle = COLORS.text;
  context.font = font(40, 800);
  context.fillText("Maiores gastos", 72, y);
  y += 58;
  const max = Math.max(1, ...input.topCategories.map((category) => category.totalCents));
  for (const category of input.topCategories.slice(0, 4)) {
    context.fillStyle = COLORS.muted;
    context.font = font(34, 600);
    context.fillText(category.name.slice(0, 28), 72, y + 26);
    context.fillStyle = COLORS.text;
    context.font = font(34, 800);
    context.textAlign = "right";
    context.fillText(brl(category.totalCents), width - 72, y + 26);
    context.textAlign = "left";
    const barWidth = Math.round(((width - 144) * category.totalCents) / max);
    context.fillStyle = COLORS.bar;
    roundedRect(context, 72, y + 44, barWidth, 14, 7);
    context.fill();
    y += 104;
  }

  context.fillStyle = COLORS.muted;
  context.font = font(28, 600);
  context.fillText("Controle Financeiro da família", 72, height - 70);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem."))),
      "image/png",
    );
  });
}

/** Compartilha o PNG (Web Share) ou baixa, quando não houver suporte. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
