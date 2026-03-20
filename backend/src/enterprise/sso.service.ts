import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { SsoConfig } from "../entities/sso-config.entity";
import { User } from "../entities/user.entity";
import { Team } from "../entities/team.entity";
import { TeamMember } from "../entities/team-member.entity";

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    @InjectRepository(SsoConfig) private ssoConfigRepo: Repository<SsoConfig>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Team) private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private memberRepo: Repository<TeamMember>,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async configureSso(
    teamId: string,
    config: {
      provider: "saml" | "oidc";
      entityId: string;
      ssoUrl: string;
      certificate: string;
      metadataUrl?: string;
      defaultRole?: string;
      enforceSSO?: boolean;
    },
  ): Promise<SsoConfig> {
    const existing = await this.ssoConfigRepo.findOneBy({ teamId });
    if (existing) {
      Object.assign(existing, config);
      return this.ssoConfigRepo.save(existing);
    }

    const ssoConfig = this.ssoConfigRepo.create({ teamId, ...config });
    return this.ssoConfigRepo.save(ssoConfig);
  }

  async getSsoConfig(teamId: string): Promise<SsoConfig | null> {
    return this.ssoConfigRepo.findOneBy({ teamId });
  }

  async deleteSsoConfig(teamId: string): Promise<boolean> {
    const result = await this.ssoConfigRepo.delete({ teamId });
    return (result.affected ?? 0) > 0;
  }

  async toggleSso(teamId: string, enabled: boolean): Promise<SsoConfig> {
    const config = await this.ssoConfigRepo.findOneBy({ teamId });
    if (!config)
      throw new NotFoundException("SSO not configured for this team");
    config.enabled = enabled;
    return this.ssoConfigRepo.save(config);
  }

  /**
   * Generate the SAML AuthnRequest redirect URL for a team.
   */
  async initiateSamlLogin(teamId: string): Promise<{ redirectUrl: string }> {
    const config = await this.ssoConfigRepo.findOneBy({
      teamId,
      enabled: true,
    });
    if (!config) throw new NotFoundException("SSO not configured or disabled");

    const appUrl = this.configService.get("APP_URL", "http://localhost:3001");
    const callbackUrl = `${appUrl}/api/enterprise/sso/callback`;
    const requestId = `_${crypto.randomUUID()}`;

    // Build SAML AuthnRequest XML
    const authnRequest = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${requestId}"
        Version="2.0"
        IssueInstant="${new Date().toISOString()}"
        AssertionConsumerServiceURL="${callbackUrl}"
        Destination="${config.ssoUrl}">
        <saml:Issuer>${config.entityId}</saml:Issuer>
      </samlp:AuthnRequest>
    `.trim();

    const encoded = Buffer.from(authnRequest).toString("base64");
    const redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(encoded)}&RelayState=${encodeURIComponent(teamId)}`;

    return { redirectUrl };
  }

  /**
   * Handle the SAML callback response. Parses the assertion, provisions the user,
   * and returns a JWT token.
   */
  async handleSamlCallback(
    samlResponse: string,
    relayState: string,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    const teamId = relayState;
    const config = await this.ssoConfigRepo.findOneBy({
      teamId,
      enabled: true,
    });
    if (!config) throw new UnauthorizedException("SSO not configured");

    // Decode and parse the SAML response
    const decoded = Buffer.from(samlResponse, "base64").toString("utf-8");
    const attributes = this.parseSamlAttributes(decoded);

    if (!attributes.email) {
      throw new BadRequestException("SAML response missing email attribute");
    }

    // Provision or find user
    let user = await this.userRepo.findOneBy({ email: attributes.email });
    if (!user) {
      user = this.userRepo.create({
        email: attributes.email,
        name: attributes.name || attributes.email.split("@")[0],
        ssoProvider: config.provider,
        ssoExternalId: attributes.nameId ?? "",
        planTier: "enterprise",
        subscriptionStatus: "active",
        emailVerifiedAt: new Date(),
      });
      await this.userRepo.save(user);
      this.logger.log(`SSO provisioned new user: ${user.email}`);
    } else {
      user.ssoProvider = config.provider;
      user.ssoExternalId = attributes.nameId ?? "";
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
      }
      await this.userRepo.save(user);
    }

    // Ensure user is a team member
    const existingMember = await this.memberRepo.findOneBy({
      teamId,
      userId: user.id,
    });
    if (!existingMember) {
      const role = config.defaultRole === "admin" ? "admin" : "member";
      await this.memberRepo.save(
        this.memberRepo.create({ teamId, userId: user.id, role }),
      );
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        planTier: user.planTier,
        subscriptionStatus: user.subscriptionStatus,
      },
    };
  }

  /**
   * Generate SAML SP metadata XML for the team's configuration.
   */
  async getSpMetadata(teamId: string): Promise<string> {
    const config = await this.ssoConfigRepo.findOneBy({ teamId });
    if (!config) throw new NotFoundException("SSO not configured");

    const appUrl = this.configService.get("APP_URL", "http://localhost:3001");
    const callbackUrl = `${appUrl}/api/enterprise/sso/callback`;

    return `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${config.entityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${callbackUrl}"
      index="0"
      isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  private parseSamlAttributes(xml: string): {
    email?: string;
    name?: string;
    nameId?: string;
  } {
    // Lightweight XML attribute extraction (production should use a proper SAML library)
    const extract = (tag: string): string | undefined => {
      const regex = new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<`, "i");
      const match = xml.match(regex);
      return match?.[1]?.trim();
    };

    return {
      email: extract("emailAddress") ?? extract("mail") ?? extract("email"),
      name: extract("displayName") ?? extract("givenName"),
      nameId: extract("NameID"),
    };
  }
}
