# 📧 NetoInsight - MailSlurp Service (Python) - CON INVITATION + PASSWORD RESET

import mailslurp_client
from typing import Dict, Optional
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class MailSlurpService:

    def __init__(self):
        self.api_key = os.getenv("MAILSLURP_API_KEY")
        self.inbox_id = os.getenv(
            "MAILSLURP_INBOX_ID", "81ab8878-8987-4a9c-a534-299ef25dbe2f"
        )
        self.from_email = os.getenv(
            "MAILSLURP_FROM_EMAIL", "81ab8878-8987-4a9c-a534-299ef25dbe2f@soyneto.com"
        )

        if not self.api_key:
            raise ValueError("MAILSLURP_API_KEY no configurada en variables de entorno")

        configuration = mailslurp_client.Configuration()
        configuration.api_key["x-api-key"] = self.api_key

        self.api_client = mailslurp_client.ApiClient(configuration)
        self.inbox_controller = mailslurp_client.InboxControllerApi(self.api_client)

        logger.info(f"✅ [MAILSLURP] Service initialized with inbox: {self.inbox_id}")

    # ─────────────────────────────────────────────────────────────
    #  INVITATION EMAIL
    # ─────────────────────────────────────────────────────────────

    def send_invitation_email(
        self,
        email: str,
        invitation_token: str,
        tenant_name: str,
        invited_by_name: str,
        invited_by_email: str,
        role: str,
        expires_at: datetime,
        frontend_url: str,
    ) -> Dict:
        try:
            logger.info(f"📧 [MAILSLURP] Sending invitation to: {email}")

            html_content = self._build_invitation_html(
                email=email,
                invitation_token=invitation_token,
                tenant_name=tenant_name,
                invited_by_name=invited_by_name,
                invited_by_email=invited_by_email,
                role=role,
                expires_at=expires_at,
                frontend_url=frontend_url,
            )

            result = self._send(
                to=email,
                subject=f"Tienes una invitación a NetoInsight — {tenant_name}",
                html=html_content,
                reply_to=invited_by_email,
            )

            logger.info(f"✅ [MAILSLURP] Invitation sent. ID: {result.id}")
            return {
                "success": True,
                "message_id": result.id,
                "sent_at": datetime.utcnow().isoformat(),
                "recipient": email,
            }

        except Exception as e:
            logger.error(f"❌ [MAILSLURP] Error sending invitation: {str(e)}")
            return {"success": False, "error": str(e), "recipient": email}

    # ─────────────────────────────────────────────────────────────
    #  PASSWORD RESET EMAIL
    # ─────────────────────────────────────────────────────────────

    def send_password_reset_email(
        self, email: str, reset_url: str, expires_at: datetime
    ) -> Dict:
        try:
            logger.info(f"🔑 [MAILSLURP] Sending password reset to: {email}")

            html_content = self._build_password_reset_html(
                email=email, reset_url=reset_url, expires_at=expires_at
            )

            result = self._send(
                to=email,
                subject="Restablece tu contraseña — NetoInsight",
                html=html_content,
                reply_to=None,
            )

            logger.info(f"✅ [MAILSLURP] Password reset sent. ID: {result.id}")
            return {
                "success": True,
                "message_id": result.id,
                "sent_at": datetime.utcnow().isoformat(),
                "recipient": email,
            }

        except Exception as e:
            logger.error(f"❌ [MAILSLURP] Error sending password reset: {str(e)}")
            return {"success": False, "error": str(e), "recipient": email}

    # ─────────────────────────────────────────────────────────────
    #  SUPPORT TICKET EMAIL
    # ─────────────────────────────────────────────────────────────

    def send_support_email(
        self,
        user_name: str,
        user_email: str,
        tenant_name: str,
        topic: str,
        details: str,
    ) -> Dict:
        try:
            target_email = "cuenta.conexion@tiendasnetows.com"
            logger.info(
                f"🛠️ [MAILSLURP] Sending support ticket to: {target_email} from {user_email}"
            )

            html_content = self._build_support_html(
                user_name=user_name,
                user_email=user_email,
                tenant_name=tenant_name,
                topic=topic,
                details=details,
            )

            result = self._send(
                to=target_email,
                subject=f"Soporte NetoInsight: {topic} - {tenant_name}",
                html=html_content,
                reply_to=user_email,
            )

            logger.info(f"✅ [MAILSLURP] Support ticket sent. ID: {result.id}")
            return {
                "success": True,
                "message_id": result.id,
                "sent_at": datetime.utcnow().isoformat(),
                "recipient": target_email,
            }

        except Exception as e:
            logger.error(f"❌ [MAILSLURP] Error sending support ticket: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "recipient": "cuenta.conexion@tiendasnetows.com",
            }

    # ─────────────────────────────────────────────────────────────
    #  VERIFY CONNECTION
    # ─────────────────────────────────────────────────────────────

    def verify_connection(self) -> Dict:
        try:
            inbox = self.inbox_controller.get_inbox(self.inbox_id)
            return {
                "success": True,
                "inbox_id": self.inbox_id,
                "email_address": inbox.email_address,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ─────────────────────────────────────────────────────────────
    #  PRIVATE HELPERS
    # ─────────────────────────────────────────────────────────────

    def _send(self, to: str, subject: str, html: str, reply_to: Optional[str]) -> any:
        """Método centralizado de envío."""
        options = mailslurp_client.SendEmailOptions(
            to=[to],
            subject=subject,
            body=html,
            is_html=True,
            send_strategy="SINGLE_MESSAGE",
            use_inbox_name=False,
            _from=self.from_email,
            charset="UTF-8",
        )
        if reply_to:
            options.reply_to = reply_to

        return self.inbox_controller.send_email_and_confirm(
            inbox_id=self.inbox_id, send_email_options=options
        )

    def _load_template(self, filename: str) -> str:
        """Carga un template HTML desde la carpeta templates/."""
        template_path = os.path.join(os.path.dirname(__file__), "templates", filename)
        try:
            with open(template_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.warning(f"⚠️  Template '{filename}' not found")
            return None

    def _build_invitation_html(
        self,
        email,
        invitation_token,
        tenant_name,
        invited_by_name,
        invited_by_email,
        role,
        expires_at,
        frontend_url,
    ) -> str:
        html = (
            self._load_template("invitation_email.html")
            or self._fallback_invitation_html()
        )

        replacements = {
            "{{email}}": email,
            "{{invitationToken}}": invitation_token,
            "{{tenantName}}": tenant_name,
            "{{invitedByName}}": invited_by_name,
            "{{invitedByEmail}}": invited_by_email,
            "{{roleLabel}}": "Administrador" if role == "admin" else "Visualizador",
            "{{expirationDate}}": expires_at.strftime("%d de %B de %Y a las %H:%M UTC"),
            "{{acceptUrl}}": f"{frontend_url}/accept-invite?token={invitation_token}",
            "{{currentYear}}": str(datetime.now().year),
        }
        for k, v in replacements.items():
            html = html.replace(k, v)
        return html

    def _build_password_reset_html(
        self, email: str, reset_url: str, expires_at: datetime
    ) -> str:
        html = (
            self._load_template("password_reset_email.html")
            or self._fallback_reset_html()
        )

        replacements = {
            "{{email}}": email,
            "{{resetUrl}}": reset_url,
            "{{requestDate}}": datetime.utcnow().strftime(
                "%d de %B de %Y a las %H:%M UTC"
            ),
            "{{expirationDate}}": expires_at.strftime("%d de %B de %Y a las %H:%M UTC"),
            "{{currentYear}}": str(datetime.now().year),
        }
        for k, v in replacements.items():
            html = html.replace(k, v)
        return html

    def _fallback_invitation_html(self) -> str:
        return """<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0f1e;color:#fff;padding:40px;">
          <h2 style="color:#f58220;">Invitación a NetoInsight</h2>
          <p>{{invitedByName}} te invitó a unirte a <strong>{{tenantName}}</strong>.</p>
          <a href="{{acceptUrl}}" style="background:#e8743b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:24px;">Activar mi cuenta →</a>
          <p style="margin-top:32px;font-size:12px;color:#555;">© {{currentYear}} Neto</p>
        </body></html>"""

    def _fallback_reset_html(self) -> str:
        return """<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0f1e;color:#fff;padding:40px;">
          <h2 style="color:#f58220;">Restablece tu contraseña</h2>
          <p>Haz clic en el enlace para crear una nueva contraseña para <strong>{{email}}</strong>.</p>
          <a href="{{resetUrl}}" style="background:#e8743b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:24px;">Crear nueva contraseña →</a>
          <p style="margin-top:32px;font-size:12px;color:#555;">© {{currentYear}} Neto</p>
        </body></html>"""

    def _build_support_html(
        self,
        user_name: str,
        user_email: str,
        tenant_name: str,
        topic: str,
        details: str,
    ) -> str:
        html = (
            self._load_template("support_email.html") or self._fallback_support_html()
        )

        # Reemplazar saltos de línea con <br> para HTML
        formatted_details = details.replace("\n", "<br>")

        replacements = {
            "{{userName}}": user_name,
            "{{userEmail}}": user_email,
            "{{tenantName}}": tenant_name,
            "{{topic}}": topic,
            "{{details}}": formatted_details,
            "{{sentDate}}": datetime.utcnow().strftime(
                "%d de %B de %Y a las %H:%M UTC"
            ),
            "{{currentYear}}": str(datetime.now().year),
        }
        for k, v in replacements.items():
            html = html.replace(k, v)
        return html

    def _fallback_support_html(self) -> str:
        return """<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;color:#333;padding:40px;">
          <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.05);border-top:4px solid #f58220;">
            <h2 style="color:#0a0f1e;margin-top:0;">Nuevo Ticket de Soporte</h2>
            <p style="color:#666;font-size:14px;">Generado el {{sentDate}}</p>
            <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;">
            <p><strong>Usuario:</strong> {{userName}} ({{userEmail}})</p>
            <p><strong>Proveedor / Tenant:</strong> {{tenantName}}</p>
            <p><strong>Tema:</strong> {{topic}}</p>
            <div style="background:#f3f4f6;padding:16px;border-radius:6px;margin-top:24px;">
              <h4 style="margin-top:0;color:#0a0f1e;margin-bottom:8px;">Detalles del Problema:</h4>
              <p style="margin:0;line-height:1.6;">{{details}}</p>
            </div>
            <p style="margin-top:32px;font-size:12px;color:#888;text-align:center;">Este correo fue enviado automáticamente desde la plataforma NetoInsight.</p>
          </div>
        </body></html>"""


# ─────────────────────────────────────────────────────────────────
#  Singleton
# ─────────────────────────────────────────────────────────────────

_mailslurp_service: Optional[MailSlurpService] = None


def get_mailslurp_service() -> MailSlurpService:
    global _mailslurp_service
    if _mailslurp_service is None:
        _mailslurp_service = MailSlurpService()
    return _mailslurp_service
