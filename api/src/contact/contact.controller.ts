import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Endpoint PÚBLICO: lo usa el formulario de la landing (usuarios sin cuenta).
 * El @Public() es el único hueco intencional en el default-deny global; la
 * protección viene de la cadena global de SecurityModule — bot filter,
 * sanitization y el rate limit específico para POST /api/contact — más la
 * validación estricta del DTO y el anti-duplicado del service.
 */
@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Public contact form (landing, no auth)' })
  async create(@Body() dto: CreateContactMessageDto) {
    return this.contactService.create(dto);
  }
}
