import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { makeButton, Button } from "../objects/Button";
import { Cloud } from "../systems/Cloud";
import { Save, NAME_MAX, cleanName } from "../systems/Save";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Sign in / sign up. Deliberately skippable — the game is fully playable
 * without an account, so this screen never blocks anything.
 *
 * Email + password rather than username-only: it's what Supabase Auth does
 * properly, and it means password resets are possible. The username is the
 * public display name on the leaderboard.
 */
export class AccountScene extends Phaser.Scene {
  private mode: "in" | "up" = "in";
  private fields: Phaser.GameObjects.DOMElement[] = [];
  private buttons: Button[] = [];
  private message!: Phaser.GameObjects.Text;
  private busy = false;

  constructor() {
    super("Account");
  }

  create() {
    const { WIDTH, HEIGHT } = GAME;
    const g = this.add.graphics();
    g.fillGradientStyle(
      COLORS.bgTop,
      COLORS.bgTop,
      COLORS.bgBottom,
      COLORS.bgBottom,
      1
    );
    g.fillRect(0, 0, WIDTH, HEIGHT);

    this.message = this.add
      .text(WIDTH / 2, HEIGHT - 168, "", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#ff9d5c",
        align: "center",
        wordWrap: { width: WIDTH - 80 },
      })
      .setOrigin(0.5);

    if (!Cloud.enabled) {
      this.add
        .text(WIDTH / 2, 100, "Accounts", {
          fontFamily: FONT,
          fontSize: "28px",
          fontStyle: "600",
          color: "#eaf0ff",
        })
        .setOrigin(0.5);
      this.add
        .text(
          WIDTH / 2,
          HEIGHT / 2 - 20,
          "Not connected yet.\n\nAdd your Supabase URL and anon key\nto a .env file and rebuild.",
          {
            fontFamily: FONT,
            fontSize: "14px",
            color: "#9aa3d0",
            align: "center",
            lineSpacing: 6,
          }
        )
        .setOrigin(0.5);
      makeButton(this, {
        x: WIDTH / 2,
        y: HEIGHT - 90,
        label: "Back",
        onClick: () => this.scene.start("Menu"),
      });
      return;
    }

    this.render();
  }

  private render(): void {
    const { WIDTH, HEIGHT } = GAME;
    this.fields.forEach((f) => f.destroy());
    this.buttons.forEach((b) => b.destroy());
    this.fields = [];
    this.buttons = [];
    this.message.setText("");

    const signedIn = Cloud.signedIn;
    this.add
      .text(WIDTH / 2, 100, signedIn ? "Account" : this.mode === "in" ? "Sign in" : "Create account", {
        fontFamily: FONT,
        fontSize: "28px",
        fontStyle: "600",
        color: "#eaf0ff",
      })
      .setOrigin(0.5)
      .setDepth(5);

    if (signedIn) {
      this.add
        .text(WIDTH / 2, 170, "You're signed in.\nProgress syncs to this account.", {
          fontFamily: FONT,
          fontSize: "14px",
          color: "#9aa3d0",
          align: "center",
          lineSpacing: 6,
        })
        .setOrigin(0.5)
        .setDepth(5);
      this.buttons = [
        makeButton(this, {
          x: WIDTH / 2,
          y: 300,
          label: "Sign out",
          onClick: async () => {
            await Cloud.signOut();
            this.scene.restart();
          },
        }),
        makeButton(this, {
          x: WIDTH / 2,
          y: HEIGHT - 90,
          label: "Back",
          onClick: () => this.scene.start("Menu"),
        }),
      ];
      return;
    }

    const email = this.textField(WIDTH / 2, 190, "email", "email");
    const pass = this.textField(WIDTH / 2, 250, "password", "password");
    const user =
      this.mode === "up"
        ? this.textField(WIDTH / 2, 310, "username", "text", NAME_MAX)
        : null;

    const submitY = this.mode === "up" ? 380 : 320;
    this.buttons = [
      makeButton(this, {
        x: WIDTH / 2,
        y: submitY,
        label: this.mode === "in" ? "Sign in" : "Create account",
        primary: true,
        onClick: () => this.submit(email, pass, user),
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: submitY + 64,
        label: this.mode === "in" ? "I need an account" : "I already have one",
        onClick: () => {
          this.mode = this.mode === "in" ? "up" : "in";
          this.scene.restart();
        },
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: HEIGHT - 90,
        label: "Back",
        onClick: () => this.scene.start("Menu"),
      }),
    ];
  }

  /** A DOM input styled to match, so players get their native keyboard. */
  private textField(
    x: number,
    y: number,
    placeholder: string,
    type: string,
    maxLength?: number
  ): HTMLInputElement {
    const el = document.createElement("input");
    el.type = type === "password" ? "password" : type === "email" ? "email" : "text";
    el.placeholder = placeholder;
    if (maxLength) el.maxLength = maxLength;
    el.setAttribute("autocomplete", type === "password" ? "current-password" : "off");
    el.setAttribute("autocapitalize", "none");
    el.setAttribute("spellcheck", "false");
    el.style.cssText = [
      "width: 250px",
      "padding: 12px 14px",
      "font-size: 16px",
      `font-family: ${FONT}`,
      "color: #eaf0ff",
      "background: rgba(255,255,255,0.10)",
      "border: 1.5px solid rgba(255,255,255,0.22)",
      "border-radius: 12px",
      "outline: none",
    ].join(";");
    this.fields.push(this.add.dom(x, y, el).setDepth(5));
    return el;
  }

  private async submit(
    email: HTMLInputElement,
    pass: HTMLInputElement,
    user: HTMLInputElement | null
  ): Promise<void> {
    if (this.busy) return;
    const mail = email.value.trim();
    const pw = pass.value;
    if (!mail || !pw) {
      this.message.setText("Email and password are both required.");
      return;
    }
    if (pw.length < 6) {
      this.message.setText("Password must be at least 6 characters.");
      return;
    }

    this.busy = true;
    this.message.setColor("#9aa3d0").setText("Working…");

    let result: { ok: boolean; error?: string };
    if (this.mode === "up") {
      const username = cleanName(user?.value ?? "");
      if (username.length < 2) {
        this.busy = false;
        this.message.setColor("#ff9d5c").setText("Pick a username (2+ characters).");
        return;
      }
      result = await Cloud.signUp(mail, pw, username);
      if (result.ok) {
        // Seed the cloud profile with whatever this device already has.
        await Cloud.pushProgress(Save.name, Save.best, Save.bestRun, Save.runs);
      }
    } else {
      result = await Cloud.signIn(mail, pw);
    }

    this.busy = false;
    if (!result.ok) {
      this.message.setColor("#ff9d5c").setText(result.error ?? "Something went wrong.");
      return;
    }
    this.scene.start("Menu");
  }
}
