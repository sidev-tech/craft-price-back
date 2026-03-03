import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { PriceListItem } from './price-list-item.entity';

@Entity('price_lists')
export class PriceList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  /** Текст у верхньому колонтитулі */
  @Column({ name: 'header_text', type: 'text', nullable: true })
  headerText: string | null;

  /** Текст у нижньому колонтитулі (над обов'язковим брендингом) */
  @Column({ name: 'footer_text', type: 'text', nullable: true })
  footerText: string | null;

  /** URL логотипу */
  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  /** До 5 URL фотографій */
  @Column({ type: 'jsonb', default: [] })
  photos: string[];

  /** Ставка ПДВ у відсотках (за замовчуванням 20) */
  @Column({
    name: 'vat_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
  })
  vatRate: number;

  /** Загальні примітки до прайсу */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => PriceListItem, (item) => item.priceList, { cascade: true })
  items: PriceListItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
