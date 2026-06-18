import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { Product } from '../products/entity/product.entity';
import { Repository } from 'typeorm';
import { User } from '../users/entity/user.entity';
import { throwError } from 'rxjs';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoritesRepository : Repository<Favorite>, 
    @InjectRepository(Product)
    private readonly productsRepository : Repository<Product>, 
    @InjectRepository(User) 
    private readonly usersRepository : Repository<User>, 
  ){}

  async getMyFavorites(userId:string) {
    return this.favoritesRepository.find({
      where :{
        user : {
          id : userId
        }
      }, 
      relations : ["user", "product"], 
      order : {
        createdAt : "DESC",
      }
    })
  }

  async addFavorite(userId:string, productId:string) {
    const user = await this.usersRepository.findOne({
      where : {id: userId}
    })

    if(!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const product = await this.productsRepository.findOne({
      where : {id : productId}
    })

    if(!product) throw new NotFoundException("Producto no encontrado"); 

    const exists = await this.favoritesRepository.findOne({
      where : {
        user : {id : userId},
        product : {id : productId}
      }
    }); 

    if(exists) {
      throw new ConflictException("El producto ya esta en favoritos"); 
    }

    const favorite = this.favoritesRepository.create({
      user, 
      product, 
    })

    return this.favoritesRepository.save(favorite);
  }

  async removeFavorite(userId:string, productId:string){
    const favorite = await this.favoritesRepository.findOne({
      where : {
        user : {id : userId},
        product : {id : productId}
      }
    })

    if(!favorite) throw new NotFoundException("Favorito no encontrado");

    await this.favoritesRepository.remove(favorite); 

    return {
      message : "Favorito eliminado"
    }; 
  }
}
