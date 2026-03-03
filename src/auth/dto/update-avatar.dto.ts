import { IsUrl } from 'class-validator';

export class UpdateAvatarDto {
  @IsUrl({}, { message: 'avatar має бути валідним URL' })
  avatar: string;
}
