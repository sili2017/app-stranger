import { IsIn, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}
